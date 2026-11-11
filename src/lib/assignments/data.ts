import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { endAssignment, recomputeAssignedOn } from "./lifecycle";
import { clientContext, getClient, listClients, withFacts, type ClientWithFacts } from "@/lib/clients/data";
import { clientLabel } from "@/lib/clients/constants";
import { getRuleSettings } from "@/lib/settings";
import { businessDaysBetween } from "@/lib/business-days";
import { addDays } from "@/lib/dates";
import {
  associateLoad,
  type Band,
  evaluateCandidate,
  loadBand,
  rankCandidates,
  type Evaluation,
  type HeldSeat,
  type Load,
  type RuleAssociate,
  type RuleClient,
} from "./rules";
import { canFill, type Seat, seatRole, SEATS_BY_MODEL } from "./seats";

const { assignments, associates, clients, associateCapabilities, capabilities, associatePto } = schema;

export type Assignment = typeof assignments.$inferSelect;

export class AssignmentError extends Error {}

/* ---------------------------------------- Inputs ---------------------------------------- */

export function toRuleClient(c: ClientWithFacts, today: string): RuleClient {
  return {
    id: c.id,
    lifecycleStage: c.lifecycleStage,
    supportModel: c.supportModel,
    firstInputDate: c.firstInputDate,
    benefitsStartDate: c.benefitsStartDate,
    timeZone: c.timeZone,
    employeeCount: c.employeeCount,
    controlCount: c.controlCount,
    payrollComplexity: c.payrollComplexity,
    implementationType: c.implementationType,
    previousVendor: c.previousVendor,
    weight: c.weight.total,
    isFastStart: c.fastStart?.isFastStart ?? false,
    fastStartFrom: c.assignedOn ?? today,
  };
}

/** Every associate with the facts the rules engine needs. */
export function loadRuleAssociates(facts: ClientWithFacts[]): RuleAssociate[] {
  const byClient = new Map(facts.map((c) => [c.id, c]));
  const caps = db
    .select({ associateId: associateCapabilities.associateId, name: capabilities.name, level: associateCapabilities.proficiency })
    .from(associateCapabilities)
    .innerJoin(capabilities, eq(capabilities.id, associateCapabilities.capabilityId))
    .all();
  const pto = db.select().from(associatePto).orderBy(asc(associatePto.startDate)).all();
  const rows = db.select().from(assignments).all();

  return db
    .select()
    .from(associates)
    .orderBy(asc(associates.name))
    .all()
    .map((a) => {
      const mine = rows.filter((r) => r.associateId === a.id);
      const held: HeldSeat[] = mine
        .filter((r) => r.status === "ACTIVE")
        .flatMap((r) => {
          const c = byClient.get(r.clientId);
          if (!c) return [];
          return [{
            clientId: c.id,
            label: clientLabel(c),
            seat: r.seat,
            stage: c.lifecycleStage,
            supportModel: c.supportModel,
            firstInputDate: c.firstInputDate,
            weight: c.weight.total,
          }];
        });
      return {
        id: a.id,
        name: a.name,
        isActive: a.isActive,
        canPm: a.canPm,
        canPayroll: a.canPayroll,
        timeZone: a.timeZone,
        targetLoad: a.targetLoad,
        capabilities: Object.fromEntries(caps.filter((c) => c.associateId === a.id).map((c) => [c.name.toLowerCase(), c.level])),
        pto: pto.filter((p) => p.associateId === a.id),
        held,
        history: mine.flatMap((r) => {
          const c = byClient.get(r.clientId);
          return c ? [{ implementationType: c.implementationType, previousVendor: c.previousVendor }] : [];
        }),
      };
    });
}

/* ------------------------------------------ Loads ------------------------------------------ */

/** Load for every associate, keyed by associate id. */
export type AssociateLoad = Load & { nextFirstInput: string | null; targetLoad: number; band: Band };

export function allLoads(): Map<number, AssociateLoad> {
  const ctx = clientContext();
  const facts = withFacts(listClients(), ctx);
  const rules = getRuleSettings();
  return new Map(
    loadRuleAssociates(facts).map((a) => {
      const upcoming = a.held
        .filter((h) => h.stage === "IMPLEMENTATION" && h.firstInputDate && h.firstInputDate >= ctx.today)
        .map((h) => h.firstInputDate!)
        .sort();
      const load = associateLoad(a.held, rules);
      return [a.id, { ...load, nextFirstInput: upcoming[0] ?? null, targetLoad: a.targetLoad, band: loadBand(load.projected, rules) }];
    }),
  );
}

/* ------------------------------------------ Teams ------------------------------------------ */

export type TeamSeat = {
  seat: Seat;
  assignment: (Assignment & { associateName: string }) | null;
};

export function activeAssignments(clientId: number) {
  return db
    .select({ a: assignments, associateName: associates.name })
    .from(assignments)
    .innerJoin(associates, eq(associates.id, assignments.associateId))
    .where(and(eq(assignments.clientId, clientId), eq(assignments.status, "ACTIVE")))
    .all()
    .map(({ a, associateName }) => ({ ...a, associateName }));
}

/** The client's seats with who holds each, in seat order. */
export function getTeam(client: { id: number; supportModel: ClientWithFacts["supportModel"] }): TeamSeat[] {
  if (!client.supportModel) return [];
  const active = activeAssignments(client.id);
  return SEATS_BY_MODEL[client.supportModel].map((seat) => ({
    seat,
    assignment: active.find((a) => a.seat === seat) ?? null,
  }));
}

export function pastAssignments(clientId: number) {
  return db
    .select({ a: assignments, associateName: associates.name })
    .from(assignments)
    .innerJoin(associates, eq(associates.id, assignments.associateId))
    .where(and(eq(assignments.clientId, clientId), eq(assignments.status, "ENDED")))
    .orderBy(asc(assignments.startDate))
    .all()
    .map(({ a, associateName }) => ({ ...a, associateName }));
}

/** Everything an associate holds or has held, newest first. */
export function associateAssignments(associateId: number) {
  return db
    .select({ a: assignments, c: clients })
    .from(assignments)
    .innerJoin(clients, eq(clients.id, assignments.clientId))
    .where(eq(assignments.associateId, associateId))
    .orderBy(asc(assignments.status), asc(clients.firstInputDate))
    .all();
}

export function countAssignmentsForAssociate(associateId: number): number {
  return db.select({ id: assignments.id }).from(assignments).where(eq(assignments.associateId, associateId)).all().length;
}

/* ---------------------------------------- Evaluation ---------------------------------------- */

export type SeatEvaluation = {
  client: ClientWithFacts;
  seat: Seat;
  current: TeamSeat["assignment"];
  candidates: Evaluation[];
};

/** Ranked candidates for one seat. The current holder is evaluated as if not yet assigned. */
export function evaluateSeat(clientId: number, seat: Seat): SeatEvaluation | null {
  const ctx = clientContext();
  const facts = withFacts(listClients(), ctx);
  const client = facts.find((c) => c.id === clientId);
  if (!client?.supportModel || !SEATS_BY_MODEL[client.supportModel].includes(seat)) return null;

  const team = getTeam(client);
  const current = team.find((t) => t.seat === seat)?.assignment ?? null;
  const teamAssociateIds = team.filter((t) => t.seat !== seat && t.assignment).map((t) => t.assignment!.associateId);
  const rules = getRuleSettings();
  const ruleClient = toRuleClient(client, ctx.today);
  const candidates = rankCandidates(
    loadRuleAssociates(facts).map((a) =>
      evaluateCandidate(ruleClient, seat, a, { today: ctx.today, holidays: ctx.holidays, rules, teamAssociateIds }),
    ),
  );
  return { client, seat, current, candidates };
}

/* ----------------------------------------- Changes ----------------------------------------- */

export function assign(input: { clientId: number; seat: Seat; associateId: number; overrideNote?: string | null }) {
  const evaluation = evaluateSeat(input.clientId, input.seat);
  if (!evaluation) throw new AssignmentError("This seat is not part of the client's support model.");
  const { client, current } = evaluation;
  if (client.lifecycleStage === "SERVICE") throw new AssignmentError("Clients in Service cannot be assigned.");
  if (current?.associateId === input.associateId) return;

  const candidate = evaluation.candidates.find((c) => c.associateId === input.associateId);
  if (!candidate) throw new AssignmentError("Associate not found.");
  if (candidate.status === "ineligible") throw new AssignmentError(`Cannot assign: ${candidate.reasons.join("; ")}.`);
  if (candidate.status === "knocked_out" && !input.overrideNote) {
    throw new AssignmentError("This associate is knocked out by PTO. Confirm the override to assign anyway.");
  }

  const today = clientContext().today;
  db.transaction((tx) => {
    if (current) {
      const row = tx.select().from(assignments).where(eq(assignments.id, current.id)).get();
      if (row) endAssignment(tx, row, today, "REPLACED");
    }
    tx.insert(assignments)
      .values({
        clientId: client.id,
        associateId: input.associateId,
        seat: input.seat,
        startDate: today,
        overrideNote: candidate.status === "knocked_out" ? input.overrideNote ?? null : null,
      })
      .run();
    if (client.lifecycleStage === "IMPLEMENTATION" && !client.assignedOn) {
      tx.update(clients).set({ assignedOn: today }).where(eq(clients.id, client.id)).run();
    }
  });
}

export function unassign(assignmentId: number): Assignment | undefined {
  const row = db.select().from(assignments).where(eq(assignments.id, assignmentId)).get();
  if (!row || row.status !== "ACTIVE") return undefined;
  const today = clientContext().today;
  db.transaction((tx) => {
    endAssignment(tx, row, today, "UNASSIGNED");
    recomputeAssignedOn(tx, row.clientId);
  });
  return row;
}

/** Ends assignments in seats the client's support model no longer has. */
export function reconcileSeats(clientId: number) {
  const client = getClient(clientId);
  if (!client) return 0;
  const valid: Seat[] = client.supportModel ? SEATS_BY_MODEL[client.supportModel] : [];
  const stale = db
    .select()
    .from(assignments)
    .where(and(eq(assignments.clientId, clientId), eq(assignments.status, "ACTIVE")))
    .all()
    .filter((a) => !valid.includes(a.seat));
  if (!stale.length) return 0;
  const today = clientContext().today;
  db.transaction((tx) => {
    for (const a of stale) endAssignment(tx, a, today, "UNASSIGNED");
    recomputeAssignedOn(tx, clientId);
  });
  return stale.length;
}

/** Seat ability check used when an associate's seats are edited. */
export function seatsNoLongerAllowed(associateId: number, ability: { canPm: boolean; canPayroll: boolean }) {
  return db
    .select({ a: assignments, c: clients })
    .from(assignments)
    .innerJoin(clients, eq(clients.id, assignments.clientId))
    .where(and(eq(assignments.associateId, associateId), eq(assignments.status, "ACTIVE")))
    .all()
    .filter(({ a }) => !canFill(seatRole(a.seat), ability))
    .map(({ c }) => clientLabel(c));
}


/* ---------------------------------------- Overviews ---------------------------------------- */

export type QueueItem = ClientWithFacts & { seats: TeamSeat[]; filled: number };

/** Clients with open seats: implementations first (fast starts, then by first input), then prospects. */
export function assignmentQueue(): { implementations: QueueItem[]; prospects: QueueItem[] } {
  const facts = withFacts(listClients());
  const items = facts
    .filter((c) => c.lifecycleStage !== "SERVICE" && c.supportModel)
    .map((c) => {
      const seats = getTeam(c);
      return { ...c, seats, filled: seats.filter((s) => s.assignment).length };
    });
  const byUrgency = (a: QueueItem, b: QueueItem) =>
    Number(b.fastStart?.isFastStart ?? false) - Number(a.fastStart?.isFastStart ?? false) ||
    (a.firstInputDate ?? "9999").localeCompare(b.firstInputDate ?? "9999");
  return {
    implementations: items.filter((c) => c.lifecycleStage === "IMPLEMENTATION" && c.filled < c.seats.length).sort(byUrgency),
    prospects: items.filter((c) => c.lifecycleStage === "PROSPECT").sort(byUrgency),
  };
}

export type TimelineEntry = {
  clientId: number;
  label: string;
  firstInputDate: string;
  openSeats: number;
  team: { associateId: number; name: string; conflictWith: string[] }[];
};

/** Implementation first inputs in the next `days` calendar days, grouped by week (Monday). */
export function firstInputTimeline(days = 60): { weekOf: string; entries: TimelineEntry[] }[] {
  const ctx = clientContext();
  const rules = getRuleSettings();
  const facts = withFacts(listClients(), ctx).filter((c) => c.lifecycleStage === "IMPLEMENTATION" && c.firstInputDate);
  const end = addDays(ctx.today, days);
  const rows = db
    .select({ clientId: assignments.clientId, associateId: assignments.associateId, name: associates.name })
    .from(assignments)
    .innerJoin(associates, eq(associates.id, assignments.associateId))
    .where(eq(assignments.status, "ACTIVE"))
    .all();
  const byId = new Map(facts.map((c) => [c.id, c]));

  const entries: TimelineEntry[] = facts
    .filter((c) => c.firstInputDate! >= ctx.today && c.firstInputDate! <= end)
    .map((c) => {
      const team = rows.filter((r) => r.clientId === c.id);
      return {
        clientId: c.id,
        label: clientLabel(c),
        firstInputDate: c.firstInputDate!,
        openSeats: (c.supportModel ? SEATS_BY_MODEL[c.supportModel].length : 0) - team.length,
        team: team.map((m) => ({
          associateId: m.associateId,
          name: m.name,
          conflictWith: rows
            .filter((o) => o.associateId === m.associateId && o.clientId !== c.id)
            .map((o) => byId.get(o.clientId))
            .filter((o): o is ClientWithFacts => !!o?.firstInputDate)
            .filter((o) => Math.abs(businessDaysBetween(c.firstInputDate!, o.firstInputDate!, ctx.holidays)) <= rules.collisionConflict)
            .map((o) => clientLabel(o)),
        })),
      };
    })
    .sort((a, b) => a.firstInputDate.localeCompare(b.firstInputDate));

  const weeks = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const dow = new Date(`${e.firstInputDate}T00:00:00Z`).getUTCDay();
    const monday = addDays(e.firstInputDate, -((dow + 6) % 7));
    weeks.set(monday, [...(weeks.get(monday) ?? []), e]);
  }
  return [...weeks.entries()].map(([weekOf, list]) => ({ weekOf, entries: list }));
}

/** Active team member names per client id. */
export function teamsByClient(): Map<number, { associateId: number; name: string }[]> {
  const rows = db
    .select({ clientId: assignments.clientId, associateId: assignments.associateId, name: associates.name, seat: assignments.seat })
    .from(assignments)
    .innerJoin(associates, eq(associates.id, assignments.associateId))
    .where(eq(assignments.status, "ACTIVE"))
    .orderBy(asc(assignments.seat))
    .all();
  const out = new Map<number, { associateId: number; name: string }[]>();
  for (const r of rows) out.set(r.clientId, [...(out.get(r.clientId) ?? []), { associateId: r.associateId, name: r.name }]);
  return out;
}
