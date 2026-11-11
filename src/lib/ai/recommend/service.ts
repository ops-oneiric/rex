import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAnthropicClient } from "@/lib/ai/client";
import { clientLabel } from "@/lib/clients/constants";
import { clientContext, listClients, withFacts } from "@/lib/clients/data";
import { getTeam, loadRuleAssociates, toRuleClient } from "@/lib/assignments/data";
import { clientNeeds, evaluateCandidate, rankCandidates } from "@/lib/assignments/rules";
import type { Seat } from "@/lib/assignments/seats";
import { buildAliasMap, type AliasMap, unaliasText } from "@/lib/privacy/alias";
import { getAiModel, getExtraNames, getRuleSettings } from "@/lib/settings";
import { endAssignment } from "@/lib/assignments/lifecycle";
import {
  buildPayload,
  PROMPT_VERSION,
  type RecommendationInput,
  type RecommendationOutput,
  requestRecommendation,
  userMessage,
  validateTeams,
} from "./core";

const { aiRecommendations, assignments, clients, associates } = schema;

export class RecommendationError extends Error {}

/* ------------------------------------------ Input ------------------------------------------ */

/** Everything needed to ask for a team for one client, with a fresh alias map. */
export function buildInputForClient(clientId: number): RecommendationInput {
  const ctx = clientContext();
  const facts = withFacts(listClients(), ctx);
  const client = facts.find((c) => c.id === clientId);
  if (!client) throw new RecommendationError("Client not found.");
  if (!client.supportModel) throw new RecommendationError("Set a support model first.");
  if (client.lifecycleStage === "SERVICE") throw new RecommendationError("Clients in Service do not take assignments.");

  const team = getTeam(client);
  const open = team.filter((t) => !t.assignment).map((t) => t.seat);
  if (open.length === 0) throw new RecommendationError("Every seat is already filled.");
  const fixedMembers = team.filter((t) => t.assignment).map((t) => ({ seat: t.seat, associateId: t.assignment!.associateId }));

  const rules = getRuleSettings();
  const ruleClient = toRuleClient(client, ctx.today);
  const ruleAssociates = loadRuleAssociates(facts);
  const teamIds = fixedMembers.map((m) => m.associateId);
  const openSeats = open.map((seat) => ({
    seat,
    candidates: rankCandidates(
      ruleAssociates.map((a) => evaluateCandidate(ruleClient, seat, a, { today: ctx.today, holidays: ctx.holidays, rules, teamAssociateIds: teamIds })),
    ),
  }));

  const allAssociates = db.select().from(associates).all();
  const subjects = {
    clients: facts.map((c) => ({ id: c.id, companyCode: c.companyCode, displayName: c.displayName, label: clientLabel(c) })),
    associates: allAssociates.map((a) => ({ id: a.id, name: a.name })),
    extraNames: getExtraNames(),
  };

  return {
    client: {
      ...ruleClient,
      notes: client.notes,
      needs: clientNeeds(ruleClient, ctx.holidays),
      businessDaysToFirstInput: client.businessDaysToFirstInput,
      label: clientLabel(client),
    },
    openSeats,
    fixedMembers,
    associateProfiles: new Map(
      ruleAssociates.map((a) => {
        const row = allAssociates.find((x) => x.id === a.id)!;
        return [a.id, { capabilities: a.capabilities, notes: row.capabilityNotes, timeZone: a.timeZone, targetLoad: a.targetLoad }];
      }),
    ),
    subjects,
    map: buildAliasMap(subjects),
  };
}

/** The coded message Claude would receive, for the "what will be sent" preview. */
export function previewForClient(clientId: number): string {
  return userMessage(buildPayload(buildInputForClient(clientId)));
}

/* ------------------------------------------ Running ------------------------------------------ */

export async function runRecommendation(clientId: number): Promise<number> {
  const anthropic = getAnthropicClient({ timeoutMs: 5 * 60_000, maxRetries: 1 });
  if (!anthropic) throw new RecommendationError("Save a Claude API key in Settings first.");
  const input = buildInputForClient(clientId);
  if (input.openSeats.every((s) => s.candidates.every((c) => c.status !== "eligible"))) {
    throw new RecommendationError("No associate is eligible for the open seats, so there is nothing to recommend.");
  }
  const payload = buildPayload(input);
  const model = getAiModel();
  const result = await requestRecommendation(anthropic, model, payload);

  const row = db
    .insert(aiRecommendations)
    .values({
      clientId,
      status: result.ok ? "COMPLETED" : "FAILED",
      error: result.ok ? null : result.error,
      model,
      servedModel: result.ok ? result.servedModel : null,
      promptVersion: PROMPT_VERSION,
      requestPayload: userMessage(payload),
      aliasMap: input.map,
      response: result.ok ? result.output : null,
      inputTokens: result.ok ? result.usage.input : null,
      outputTokens: result.ok ? result.usage.output : null,
      cacheReadTokens: result.ok ? result.usage.cacheRead : null,
      cacheWriteTokens: result.ok ? result.usage.cacheWrite : null,
      costUsd: result.costUsd ?? null,
      durationMs: result.durationMs,
    })
    .returning({ id: aiRecommendations.id })
    .get();
  return row.id;
}

/* ------------------------------------------ Reading ------------------------------------------ */

export type RecommendationView = {
  id: number;
  clientId: number;
  createdAt: Date;
  status: "COMPLETED" | "FAILED";
  error: string | null;
  model: string;
  servedModel: string | null;
  promptVersion: string;
  outcome: "PENDING" | "ACCEPTED" | "MODIFIED" | "REJECTED";
  outcomeReason: string | null;
  costUsd: number | null;
  durationMs: number | null;
  tokens: { input: number; output: number; cacheRead: number } | null;
  summary: string;
  cautions: string[];
  teams: {
    index: number;
    fitScore: number;
    confidence: "low" | "medium" | "high";
    rationale: string;
    factors: Record<"pto" | "collisions" | "capacity" | "capability" | "time_zone", string>;
    risks: string[];
    members: { seat: Seat; associateId: number; name: string }[];
  }[];
  /** The coded message exactly as sent. */
  requestPayload: string;
  /** Whether the client's open seats still match the ones this recommendation filled. */
  stillApplicable: boolean;
};

export function getRecommendation(id: number): RecommendationView | null {
  const row = db.select().from(aiRecommendations).where(eq(aiRecommendations.id, id)).get();
  if (!row) return null;
  const map = row.aliasMap as AliasMap;
  const output = row.response as RecommendationOutput | null;
  const un = (t: string) => unaliasText(t, map);

  let teams: RecommendationView["teams"] = [];
  const problems: string[] = [];
  let stillApplicable = false;
  if (output) {
    // Re-validate against the client as it is now, so stale suggestions are not applied.
    const ctxInput = (() => {
      try {
        return buildInputForClient(row.clientId);
      } catch {
        return null;
      }
    })();
    const original = JSON.parse(row.requestPayload.slice(row.requestPayload.indexOf("{"))) as ReturnType<typeof buildPayload>;
    const openNow = ctxInput?.openSeats.map((s) => s.seat).join(",") ?? "";
    stillApplicable = !!ctxInput && openNow === original.open_seats.map((s) => s.seat).join(",");
    const names = new Map(db.select({ id: associates.id, name: associates.name }).from(associates).all().map((a) => [a.id, a.name]));
    const checked = validateTeams(output, {
      openSeats: original.open_seats.map((s) => ({
        seat: s.seat as Seat,
        candidates: [
          ...s.candidates.map((c) => ({ associateId: map.entries.find((e) => e.alias === c.associate)?.id ?? -1, status: "eligible" as const })),
          ...s.excluded.map((c) => ({ associateId: map.entries.find((e) => e.alias === c.associate)?.id ?? -1, status: "knocked_out" as const })),
        ],
      })),
      fixedMembers: original.fixed_members.map((m) => ({ seat: m.seat as Seat, associateId: map.entries.find((e) => e.alias === m.associate)?.id ?? -1 })),
      map,
    });
    problems.push(...checked.problems);
    teams = checked.teams.map((t, index) => ({
      index,
      fitScore: t.fit_score,
      confidence: t.confidence,
      rationale: un(t.rationale),
      factors: {
        pto: un(t.factors.pto),
        collisions: un(t.factors.collisions),
        capacity: un(t.factors.capacity),
        capability: un(t.factors.capability),
        time_zone: un(t.factors.time_zone),
      },
      risks: t.risks.map(un),
      members: t.members.map((m) => ({ ...m, name: names.get(m.associateId) ?? "Removed associate" })),
    }));
  }

  return {
    id: row.id,
    clientId: row.clientId,
    createdAt: row.createdAt,
    status: row.status,
    error: row.error,
    model: row.model,
    servedModel: row.servedModel,
    promptVersion: row.promptVersion,
    outcome: row.outcome,
    outcomeReason: row.outcomeReason,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    tokens: row.inputTokens !== null ? { input: row.inputTokens, output: row.outputTokens ?? 0, cacheRead: row.cacheReadTokens ?? 0 } : null,
    summary: output ? un(output.summary) : "",
    cautions: [...(output?.cautions.map(un) ?? []), ...problems.map(un)],
    teams,
    requestPayload: row.requestPayload,
    stillApplicable,
  };
}

export function listRecommendations(clientId: number) {
  return db
    .select({
      id: aiRecommendations.id,
      createdAt: aiRecommendations.createdAt,
      status: aiRecommendations.status,
      outcome: aiRecommendations.outcome,
      outcomeReason: aiRecommendations.outcomeReason,
      model: aiRecommendations.model,
      costUsd: aiRecommendations.costUsd,
    })
    .from(aiRecommendations)
    .where(eq(aiRecommendations.clientId, clientId))
    .orderBy(desc(aiRecommendations.createdAt))
    .all();
}

/** Calls and estimated spend since a date, for Settings. */
export function usageSince(since: Date) {
  const rows = db
    .select({ cost: aiRecommendations.costUsd, outcome: aiRecommendations.outcome, status: aiRecommendations.status })
    .from(aiRecommendations)
    .where(gte(aiRecommendations.createdAt, since))
    .all();
  const decided = rows.filter((r) => r.outcome !== "PENDING");
  return {
    calls: rows.length,
    failed: rows.filter((r) => r.status === "FAILED").length,
    costUsd: rows.reduce((s, r) => s + (r.cost ?? 0), 0),
    accepted: decided.filter((r) => r.outcome === "ACCEPTED").length,
    modified: decided.filter((r) => r.outcome === "MODIFIED").length,
    rejected: decided.filter((r) => r.outcome === "REJECTED").length,
  };
}

/* ------------------------------------------ Deciding ------------------------------------------ */

/**
 * Applies a team (Claude's, possibly with seats swapped). Every choice is re-checked by the
 * rules engine: only eligible associates can be applied this way; PTO overrides go through
 * the manual list.
 */
export function acceptTeam(input: { recommendationId: number; teamIndex: number; choices: { seat: Seat; associateId: number }[]; reason: string | null }) {
  const rec = getRecommendation(input.recommendationId);
  if (!rec || rec.status !== "COMPLETED") throw new RecommendationError("Recommendation not found.");
  if (rec.outcome !== "PENDING") throw new RecommendationError("A decision was already recorded for this recommendation.");
  if (!rec.stillApplicable) throw new RecommendationError("The team has changed since this recommendation. Ask again for a fresh one.");
  const team = rec.teams[input.teamIndex];
  if (!team) throw new RecommendationError("That team is not available.");

  const fresh = buildInputForClient(rec.clientId);
  const seats = fresh.openSeats.map((s) => s.seat);
  if (input.choices.length !== seats.length || !seats.every((s) => input.choices.some((c) => c.seat === s))) {
    throw new RecommendationError("Choose someone for every open seat.");
  }
  const ids = input.choices.map((c) => c.associateId);
  if (new Set(ids).size !== ids.length) throw new RecommendationError("Each associate can fill only one seat.");
  for (const choice of input.choices) {
    const candidate = fresh.openSeats.find((s) => s.seat === choice.seat)!.candidates.find((c) => c.associateId === choice.associateId);
    if (!candidate || candidate.status !== "eligible") {
      throw new RecommendationError(`${candidate?.name ?? "That associate"} is not eligible for this seat. Use the manual list to override.`);
    }
  }

  const modified = input.choices.some((c) => team.members.find((m) => m.seat === c.seat)?.associateId !== c.associateId);
  const ctx = clientContext();
  const client = db.select().from(clients).where(eq(clients.id, rec.clientId)).get()!;
  db.transaction((tx) => {
    for (const choice of input.choices) {
      const existing = tx
        .select()
        .from(assignments)
        .where(and(eq(assignments.clientId, rec.clientId), eq(assignments.seat, choice.seat), eq(assignments.status, "ACTIVE")))
        .get();
      if (existing) endAssignment(tx, existing, ctx.today, "REPLACED");
      tx.insert(assignments)
        .values({
          clientId: rec.clientId,
          associateId: choice.associateId,
          seat: choice.seat,
          startDate: ctx.today,
          source: modified ? "AI_MODIFIED" : "AI_ACCEPTED",
          recommendationId: rec.id,
        })
        .run();
    }
    if (client.lifecycleStage === "IMPLEMENTATION" && !client.assignedOn) {
      tx.update(clients).set({ assignedOn: ctx.today }).where(eq(clients.id, rec.clientId)).run();
    }
    tx.update(aiRecommendations)
      .set({
        outcome: modified ? "MODIFIED" : "ACCEPTED",
        outcomeReason: input.reason,
        chosenTeam: { teamIndex: input.teamIndex, choices: input.choices },
        decidedAt: new Date(),
      })
      .where(eq(aiRecommendations.id, rec.id))
      .run();
  });
  return { modified };
}

export function rejectRecommendation(id: number, reason: string | null) {
  const row = db.select({ outcome: aiRecommendations.outcome }).from(aiRecommendations).where(eq(aiRecommendations.id, id)).get();
  if (!row) throw new RecommendationError("Recommendation not found.");
  if (row.outcome !== "PENDING") throw new RecommendationError("A decision was already recorded for this recommendation.");
  db.update(aiRecommendations)
    .set({ outcome: "REJECTED", outcomeReason: reason, decidedAt: new Date() })
    .where(eq(aiRecommendations.id, id))
    .run();
}

