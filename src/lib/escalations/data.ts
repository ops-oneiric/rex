import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  type Breakdown,
  type CodedEscalation,
  decodeSuggestion,
  ESCALATION_PROMPT_VERSION,
  ESCALATION_TREND_PROMPT_VERSION,
  type EscalationSuggestion,
  escalationMessage,
  type EscalationTrend,
  escalationTrendMessage,
  type MentionedContext,
  requestEscalationAnalysis,
  requestEscalationTrend,
} from "@/lib/ai/escalation/core";
import { seatLabel } from "@/lib/assignments/seats";
import { seatSummary } from "@/lib/associates/validation";
import { clientLabel } from "@/lib/clients/constants";
import { addDays } from "@/lib/dates";
import { aliasFor, type AliasMap, buildAliasMap, type PrivacySubjects, scrubText, unaliasText } from "@/lib/privacy/alias";
import { getAiModel, getExtraNames, today } from "@/lib/settings";
import {
  CATEGORY_LABELS,
  type EscalationCategory,
  FAULT_LABELS,
  type FaultParty,
  type Preventable,
  SEVERITY_LABELS,
  type Severity,
} from "./constants";

const { escalations, escalationAssociates, clients, associates, assignments, actionItems, trendReports } = schema;

export type Escalation = typeof escalations.$inferSelect & { suggestion: EscalationSuggestion | null };

export const STALE_ANALYSIS_MS = 3 * 60 * 1000;
export function isAnalysisStale(e: Pick<Escalation, "analysisStatus" | "updatedAt">, now = Date.now()) {
  return e.analysisStatus === "PENDING" && now - e.updatedAt.getTime() > STALE_ANALYSIS_MS;
}

/* ------------------------------------------ Privacy ------------------------------------------ */

function privacySubjects(): PrivacySubjects {
  return {
    clients: db.select().from(clients).all().map((c) => ({ id: c.id, companyCode: c.companyCode, displayName: c.displayName, label: clientLabel(c) })),
    associates: db.select({ id: associates.id, name: associates.name }).from(associates).all(),
    extraNames: getExtraNames(),
  };
}

/** What Claude is told about the clients and associates the coded text mentions. */
function mentionedContext(coded: string, map: AliasMap): MentionedContext {
  const mentioned = new Set(coded.match(/\b(?:CLIENT|ASSOC)_\d{2,}\b/g) ?? []);
  const entries = map.entries.filter((e) => mentioned.has(e.alias));
  const clientIds = entries.filter((e) => e.kind === "CLIENT").map((e) => e.id);
  const team = clientIds.length
    ? db.select().from(assignments).where(and(inArray(assignments.clientId, clientIds), eq(assignments.status, "ACTIVE"))).all()
    : [];
  const clientRows = clientIds.length ? db.select().from(clients).where(inArray(clients.id, clientIds)).all() : [];
  const associateRows = db.select().from(associates).all();
  return {
    clients: clientRows.map((c) => ({
      alias: aliasFor(map, "CLIENT", c.id),
      stage: c.lifecycleStage,
      supportModel: c.supportModel,
      implementationType: c.implementationType,
      team: team.filter((t) => t.clientId === c.id).map((t) => ({ alias: aliasFor(map, "ASSOC", t.associateId), seat: seatLabel(t.seat, c.supportModel) })),
    })),
    associates: entries
      .filter((e) => e.kind === "ASSOC")
      .map((e) => {
        const a = associateRows.find((x) => x.id === e.id)!;
        return { alias: e.alias, seats: seatSummary(a.canPm, a.canPayroll) };
      }),
  };
}

function codedRequest(occurredOn: string, details: string) {
  const subjects = privacySubjects();
  const map = buildAliasMap(subjects);
  const codedDetails = scrubText(details, subjects, map);
  return { map, message: escalationMessage({ occurredOn, codedDetails, mentioned: mentionedContext(codedDetails, map) }) };
}

/** The coded message Claude would receive, for the preview. */
export function previewEscalation(occurredOn: string, details: string): string {
  return codedRequest(occurredOn, details).message;
}

/* ------------------------------------------ Writing ------------------------------------------ */

export function createEscalation(occurredOn: string, details: string): number {
  return db
    .insert(escalations)
    .values({ occurredOn, details, analysisStatus: getAnthropicClient() ? "PENDING" : "NO_KEY" })
    .returning({ id: escalations.id })
    .get().id;
}

export function getEscalation(id: number): Escalation | undefined {
  return db.select().from(escalations).where(eq(escalations.id, id)).get() as Escalation | undefined;
}

/** Returns whether the details changed (and so need analyzing again). Confirmed fields are kept. */
export function updateEscalationDetails(id: number, occurredOn: string, details: string): boolean {
  const e = getEscalation(id);
  if (!e) return false;
  const changed = e.details !== details;
  db.update(escalations)
    .set({ occurredOn, details, updatedAt: new Date(), ...(changed ? { analysisStatus: getAnthropicClient() ? "PENDING" : "NO_KEY", analysisError: null } : {}) })
    .where(eq(escalations.id, id))
    .run();
  return changed;
}

export function markPending(id: number) {
  db.update(escalations)
    .set({ analysisStatus: getAnthropicClient() ? "PENDING" : "NO_KEY", analysisError: null, updatedAt: new Date() })
    .where(eq(escalations.id, id))
    .run();
}

export async function analyzeEscalation(id: number): Promise<void> {
  const e = getEscalation(id);
  if (!e) return;
  const anthropic = getAnthropicClient({ timeoutMs: 3 * 60_000, maxRetries: 1 });
  if (!anthropic) {
    db.update(escalations).set({ analysisStatus: "NO_KEY" }).where(eq(escalations.id, id)).run();
    return;
  }
  const { map, message } = codedRequest(e.occurredOn, e.details);
  const result = await requestEscalationAnalysis(anthropic, getAiModel(), message);
  const current = getEscalation(id);
  if (!current || current.details !== e.details) return; // edited meanwhile; that edit's analysis wins

  db.update(escalations)
    .set(
      result.ok
        ? {
            analysisStatus: "DONE",
            analysisError: null,
            suggestion: decodeSuggestion(result.output, map),
            requestPayload: message,
            aliasMap: map,
            aiModel: result.servedModel,
            promptVersion: ESCALATION_PROMPT_VERSION,
            costUsd: result.costUsd,
            analyzedAt: new Date(),
          }
        : { analysisStatus: "FAILED", analysisError: result.error, requestPayload: message, costUsd: result.costUsd ?? null, analyzedAt: new Date() },
    )
    .where(eq(escalations.id, id))
    .run();
}

export type ConfirmInput = {
  clientId: number | null;
  summary: string;
  associateIds: number[];
  faultAssociateIds: number[];
  category: EscalationCategory;
  severity: Severity;
  faultParty: FaultParty;
  faultRationale: string;
  rootCause: string;
  preventable: Preventable;
  actions: { text: string; owner: "ME" | "ASSOCIATE" }[];
};

/** Saves your reviewed values. Only confirmed values count in trends. */
export function confirmEscalation(id: number, input: ConfirmInput) {
  const involved = [...new Set([...input.associateIds, ...input.faultAssociateIds])];
  const firstAssociate = input.faultAssociateIds[0] ?? involved[0] ?? null;
  db.transaction((tx) => {
    tx.update(escalations)
      .set({
        clientId: input.clientId,
        summary: input.summary,
        category: input.category,
        severity: input.severity,
        faultParty: input.faultParty,
        faultRationale: input.faultRationale,
        rootCause: input.rootCause,
        preventable: input.preventable,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, id))
      .run();
    tx.delete(escalationAssociates).where(eq(escalationAssociates.escalationId, id)).run();
    if (involved.length) {
      tx.insert(escalationAssociates)
        .values(involved.map((associateId) => ({ escalationId: id, associateId, atFault: input.faultAssociateIds.includes(associateId) })))
        .run();
    }
    if (input.actions.length) {
      tx.insert(actionItems)
        .values(
          input.actions.map((a) => ({
            sourceType: "ESCALATION" as const,
            sourceId: id,
            associateId: firstAssociate,
            text: a.text,
            owner: a.owner,
            userEdited: true,
          })),
        )
        .run();
    }
  });
}

export function setEscalationStatus(id: number, status: "OPEN" | "RESOLVED") {
  db.update(escalations)
    .set({ status, resolvedAt: status === "RESOLVED" ? new Date() : null, updatedAt: new Date() })
    .where(eq(escalations.id, id))
    .run();
}

export function deleteEscalation(id: number) {
  db.transaction((tx) => {
    tx.delete(actionItems).where(and(eq(actionItems.sourceType, "ESCALATION"), eq(actionItems.sourceId, id))).run();
    tx.delete(escalations).where(eq(escalations.id, id)).run();
  });
}

/* ------------------------------------------ Reading ------------------------------------------ */

export type EscalationRow = Escalation & {
  clientLabel: string | null;
  people: { associateId: number; name: string; atFault: boolean }[];
};

function withPeople(rows: Escalation[]): EscalationRow[] {
  if (!rows.length) return [];
  const links = db
    .select({ escalationId: escalationAssociates.escalationId, associateId: escalationAssociates.associateId, atFault: escalationAssociates.atFault, name: associates.name })
    .from(escalationAssociates)
    .innerJoin(associates, eq(associates.id, escalationAssociates.associateId))
    .where(inArray(escalationAssociates.escalationId, rows.map((r) => r.id)))
    .all();
  const clientRows = db.select().from(clients).all();
  return rows.map((r) => {
    const c = r.clientId ? clientRows.find((x) => x.id === r.clientId) : undefined;
    return {
      ...r,
      clientLabel: c ? clientLabel(c) : null,
      people: links.filter((l) => l.escalationId === r.id).map(({ associateId, name, atFault }) => ({ associateId, name, atFault })),
    };
  });
}

export function listEscalations(): EscalationRow[] {
  return withPeople(db.select().from(escalations).orderBy(desc(escalations.occurredOn), desc(escalations.id)).all() as Escalation[]);
}

export function getEscalationRow(id: number): EscalationRow | undefined {
  const e = getEscalation(id);
  return e ? withPeople([e])[0] : undefined;
}

export function escalationsForClient(clientId: number): EscalationRow[] {
  return withPeople(
    db.select().from(escalations).where(eq(escalations.clientId, clientId)).orderBy(desc(escalations.occurredOn)).all() as Escalation[],
  );
}

export function escalationsForAssociate(associateId: number): EscalationRow[] {
  const ids = db.select({ id: escalationAssociates.escalationId }).from(escalationAssociates).where(eq(escalationAssociates.associateId, associateId)).all();
  if (!ids.length) return [];
  return withPeople(
    db.select().from(escalations).where(inArray(escalations.id, ids.map((i) => i.id))).orderBy(desc(escalations.occurredOn)).all() as Escalation[],
  );
}

export function countOpenEscalations(): number {
  return db.select({ id: escalations.id }).from(escalations).where(eq(escalations.status, "OPEN")).all().length;
}

export function escalationItems(id: number) {
  return db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.sourceType, "ESCALATION"), eq(actionItems.sourceId, id)))
    .orderBy(asc(actionItems.createdAt))
    .all();
}

/* ------------------------------------------- Trends ------------------------------------------- */

export type EscalationStats = {
  periodStart: string;
  periodEnd: string;
  total: number;
  unconfirmed: number;
  byCategory: Breakdown;
  byFault: Breakdown;
  bySeverity: Breakdown;
  byMonth: { month: string; count: number }[];
  byClient: { id: number; label: string; count: number }[];
  byAssociate: { id: number; name: string; involved: number; atFault: number }[];
  preventableShare: number | null;
};

const breakdown = <K extends string>(rows: { key: K | null }[], labels: Record<K, string>): Breakdown =>
  (Object.keys(labels) as K[])
    .map((key) => ({ key, label: labels[key], count: rows.filter((r) => r.key === key).length }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

/** Exact counts over confirmed escalations in the last `days` days. */
export function escalationStats(days = 180): EscalationStats {
  const periodEnd = today();
  const periodStart = addDays(periodEnd, -days);
  const all = withPeople(
    db.select().from(escalations).where(and(gte(escalations.occurredOn, periodStart), lte(escalations.occurredOn, periodEnd))).all() as Escalation[],
  );
  const confirmed = all.filter((e) => e.confirmedAt);
  const months = new Map<string, number>();
  for (const e of confirmed) months.set(e.occurredOn.slice(0, 7), (months.get(e.occurredOn.slice(0, 7)) ?? 0) + 1);
  const clientCounts = new Map<number, { label: string; count: number }>();
  const people = new Map<number, { name: string; involved: number; atFault: number }>();
  for (const e of confirmed) {
    if (e.clientId) clientCounts.set(e.clientId, { label: e.clientLabel ?? "", count: (clientCounts.get(e.clientId)?.count ?? 0) + 1 });
    for (const p of e.people) {
      const cur = people.get(p.associateId) ?? { name: p.name, involved: 0, atFault: 0 };
      people.set(p.associateId, { name: p.name, involved: cur.involved + 1, atFault: cur.atFault + (p.atFault ? 1 : 0) });
    }
  }
  const prevKnown = confirmed.filter((e) => e.preventable && e.preventable !== "UNCLEAR");
  return {
    periodStart,
    periodEnd,
    total: confirmed.length,
    unconfirmed: all.length - confirmed.length,
    byCategory: breakdown(confirmed.map((e) => ({ key: e.category })), CATEGORY_LABELS),
    byFault: breakdown(confirmed.map((e) => ({ key: e.faultParty })), FAULT_LABELS),
    bySeverity: breakdown(confirmed.map((e) => ({ key: e.severity })), SEVERITY_LABELS),
    byMonth: [...months.entries()].sort().map(([month, count]) => ({ month, count })),
    byClient: [...clientCounts.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count).slice(0, 8),
    byAssociate: [...people.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.atFault - a.atFault || b.involved - a.involved).slice(0, 8),
    preventableShare: prevKnown.length ? Math.round((prevKnown.filter((e) => e.preventable === "YES").length / prevKnown.length) * 100) : null,
  };
}

export type EscalationTrendReport = typeof trendReports.$inferSelect & { content: EscalationTrend | null };

export function latestEscalationTrend(): EscalationTrendReport | undefined {
  return db
    .select()
    .from(trendReports)
    .where(eq(trendReports.subjectType, "ESCALATIONS"))
    .orderBy(desc(trendReports.createdAt))
    .limit(1)
    .get() as EscalationTrendReport | undefined;
}

export class EscalationTrendError extends Error {}

/** Narrative trend over confirmed escalations. Everything sent is coded; the answer is decoded for display. */
export async function generateEscalationTrend(days = 180): Promise<EscalationTrendReport> {
  const anthropic = getAnthropicClient({ timeoutMs: 5 * 60_000, maxRetries: 1 });
  if (!anthropic) throw new EscalationTrendError("Save a Claude API key in Settings first.");
  const stats = escalationStats(days);
  if (stats.total < 2) throw new EscalationTrendError(`Trends need at least two confirmed escalations in the last ${days} days.`);

  const subjects = privacySubjects();
  const map = buildAliasMap(subjects);
  const rows = withPeople(
    db
      .select()
      .from(escalations)
      .where(and(isNotNull(escalations.confirmedAt), gte(escalations.occurredOn, stats.periodStart), lte(escalations.occurredOn, stats.periodEnd)))
      .orderBy(asc(escalations.occurredOn))
      .all() as Escalation[],
  );
  const clientRows = db.select().from(clients).all();
  const coded: CodedEscalation[] = rows.map((e) => {
    const c = e.clientId ? clientRows.find((x) => x.id === e.clientId) : undefined;
    return {
      occurredOn: e.occurredOn,
      client: e.clientId ? aliasFor(map, "CLIENT", e.clientId) : null,
      associates: e.people.map((p) => ({ alias: aliasFor(map, "ASSOC", p.associateId), atFault: p.atFault })),
      category: e.category!,
      severity: e.severity!,
      faultParty: e.faultParty!,
      preventable: e.preventable,
      rootCause: scrubText(e.rootCause ?? "", subjects, map),
      implementationType: c?.implementationType ?? null,
      stage: c?.lifecycleStage ?? null,
    };
  });
  const message = escalationTrendMessage({ ...stats, escalations: coded });
  const model = getAiModel();
  const result = await requestEscalationTrend(anthropic, model, message);
  const un = (t: string) => unaliasText(t, map);
  return db
    .insert(trendReports)
    .values({
      subjectType: "ESCALATIONS",
      subjectId: null,
      periodStart: stats.periodStart,
      periodEnd: stats.periodEnd,
      status: result.ok ? "DONE" : "FAILED",
      error: result.ok ? null : result.error,
      content: result.ok
        ? {
            overview: un(result.output.overview),
            patterns: result.output.patterns.map((p) => ({ pattern: un(p.pattern), detail: un(p.detail) })),
            process_fixes: result.output.process_fixes.map(un),
            watch_list: result.output.watch_list.map((w) => ({ who: un(w.who), reason: un(w.reason) })),
          }
        : null,
      model,
      promptVersion: ESCALATION_TREND_PROMPT_VERSION,
      costUsd: result.costUsd ?? null,
    })
    .returning()
    .get() as EscalationTrendReport;
}

/* ---------------------------------------- List items ---------------------------------------- */

/**
 * Rows for the escalation list: your confirmed values, or Claude's suggestion until you
 * confirm (the list marks those as needing review).
 */
export function toListItems(rows: EscalationRow[]) {
  const clientRows = db.select().from(clients).all();
  const names = new Map(db.select({ id: associates.id, name: associates.name }).from(associates).all().map((a) => [a.id, a.name]));
  const now = Date.now();
  return rows.map((e) => {
    const s = e.suggestion;
    const confirmed = !!e.confirmedAt;
    const suggestedClient = s?.clientId ? clientRows.find((c) => c.id === s.clientId) : undefined;
    return {
      id: e.id,
      occurredOn: e.occurredOn,
      status: e.status,
      confirmed,
      analyzing: e.analysisStatus === "PENDING" && !isAnalysisStale(e, now),
      summary: (confirmed ? e.summary : s?.summary) || e.details.slice(0, 240),
      category: confirmed ? e.category : (s?.category ?? null),
      severity: confirmed ? e.severity : (s?.severity ?? null),
      faultParty: confirmed ? e.faultParty : (s?.faultParty ?? null),
      clientLabel: confirmed ? e.clientLabel : suggestedClient ? clientLabel(suggestedClient) : null,
      people: confirmed ? e.people.map((p) => p.name) : (s?.associateIds ?? []).map((id) => names.get(id) ?? "").filter(Boolean),
    };
  });
}
