import "server-only";
import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getHolidaySet } from "@/lib/holidays";
import { getWeightSettings, today } from "@/lib/settings";
import { endAllAssignments } from "@/lib/assignments/lifecycle";
import type { Stage } from "./constants";
import { deriveClient, type DerivedClient } from "./derive";
import { allowedTransitions, missingForStage, type ClientInput } from "./validation";

const { clients, clientStageHistory } = schema;

export type Client = typeof clients.$inferSelect;
export type ClientWithFacts = Client & DerivedClient;
export type StageChange = typeof clientStageHistory.$inferSelect;

export class DuplicateCodeError extends Error {}

/** Shared context for deriving fast start, weights and business-day counts. */
export function clientContext() {
  return { today: today(), holidays: getHolidaySet(), weights: getWeightSettings() };
}

export function withFacts(rows: Client[], ctx = clientContext()): ClientWithFacts[] {
  return rows.map((c) => ({ ...c, ...deriveClient(c, ctx) }));
}

export function listClients(): Client[] {
  return db.select().from(clients).orderBy(asc(clients.firstInputDate), asc(clients.companyCode)).all();
}

export function getClient(id: number): Client | undefined {
  return db.select().from(clients).where(eq(clients.id, id)).get();
}

export function getStageHistory(clientId: number): StageChange[] {
  return db
    .select()
    .from(clientStageHistory)
    .where(eq(clientStageHistory.clientId, clientId))
    .orderBy(desc(clientStageHistory.changedAt), desc(clientStageHistory.id))
    .all();
}

export function countClientsByStage(): Record<Stage, number> {
  const rows = db.select({ stage: clients.lifecycleStage, n: count() }).from(clients).groupBy(clients.lifecycleStage).all();
  const out: Record<Stage, number> = { PROSPECT: 0, IMPLEMENTATION: 0, SERVICE: 0 };
  for (const r of rows) out[r.stage] = r.n;
  return out;
}

function assertUniqueCode(code: string | null, exceptId?: number) {
  if (!code) return;
  const clash = db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.companyCode, code), exceptId ? ne(clients.id, exceptId) : undefined))
    .get();
  if (clash) throw new DuplicateCodeError();
}

export function createClient(input: ClientInput): number {
  assertUniqueCode(input.companyCode);
  return db.transaction((tx) => {
    const { id } = tx.insert(clients).values(input).returning({ id: clients.id }).get();
    tx.insert(clientStageHistory).values({ clientId: id, fromStage: null, toStage: input.lifecycleStage, note: "Created" }).run();
    return id;
  });
}

/** Updates fields. The stage only changes through changeStage(). */
export function updateClient(id: number, input: ClientInput) {
  assertUniqueCode(input.companyCode, id);
  const { lifecycleStage: _ignored, ...fields } = input;
  void _ignored;
  db.update(clients).set({ ...fields, updatedAt: new Date() }).where(eq(clients.id, id)).run();
}

export type StageChangeResult =
  | { ok: true; endedAssignments: number }
  | { ok: false; reason: "not_allowed" }
  | { ok: false; reason: "missing"; missing: string[] };

export function changeStage(id: number, to: Stage, note: string): StageChangeResult {
  const client = getClient(id);
  if (!client || !allowedTransitions(client.lifecycleStage).includes(to)) return { ok: false, reason: "not_allowed" };
  const missing = missingForStage(client, to);
  if (missing.length) return { ok: false, reason: "missing", missing: missing.map(([, label]) => label) };

  const todayIso = today();
  const endedAssignments = db.transaction((tx) => {
    const fields: Partial<typeof clients.$inferInsert> = { lifecycleStage: to, stageChangedAt: new Date(), updatedAt: new Date() };
    let ended = 0;
    if (to === "SERVICE") {
      // Service clients leave the book: their team's assignments end today.
      ended = endAllAssignments(tx, id, todayIso);
    } else if (to === "IMPLEMENTATION" && client.lifecycleStage === "PROSPECT" && !client.assignedOn) {
      // Holds on a prospect become the real team today, which fixes the fast start date.
      const holds = tx.select({ id: schema.assignments.id }).from(schema.assignments)
        .where(and(eq(schema.assignments.clientId, id), eq(schema.assignments.status, "ACTIVE"))).all();
      if (holds.length) fields.assignedOn = todayIso;
    }
    tx.update(clients).set(fields).where(eq(clients.id, id)).run();
    tx.insert(clientStageHistory).values({ clientId: id, fromStage: client.lifecycleStage, toStage: to, note }).run();
    return ended;
  });
  return { ok: true, endedAssignments };
}

export function deleteClient(id: number) {
  db.delete(clients).where(eq(clients.id, id)).run();
}
