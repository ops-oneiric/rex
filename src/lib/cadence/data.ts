import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  INSIGHT_PROMPT_VERSION,
  type Insight,
  type ItemStats,
  itemStats,
  requestInsight,
  requestTrend,
  TREND_PROMPT_VERSION,
  type Trend,
} from "@/lib/ai/cadence/core";
import { addDays } from "@/lib/dates";
import { cadenceStatus } from "./status";
import { getAiModel, getCadenceDays, today } from "@/lib/settings";

const { cadenceEntries, actionItems, trendReports, associates, capabilities } = schema;

export type CadenceEntry = typeof cadenceEntries.$inferSelect & { insight: Insight | null };
export type ActionItem = typeof actionItems.$inferSelect;
export type TrendContent = Trend & { stats: ItemStats; meetings: number };
export type TrendReport = typeof trendReports.$inferSelect & { content: TrendContent | null };

/** An analysis still "pending" after this long was interrupted (e.g. a restart); offer a retry. */
export const STALE_ANALYSIS_MS = 3 * 60 * 1000;

export function isAnalysisStale(entry: Pick<CadenceEntry, "analysisStatus" | "updatedAt">, now = Date.now()): boolean {
  return entry.analysisStatus === "PENDING" && now - entry.updatedAt.getTime() > STALE_ANALYSIS_MS;
}

/* ------------------------------------------ Overview ------------------------------------------ */

/** Directly managed, active associates with their 1:1 rhythm and open action items. */
export function cadenceOverview() {
  const todayIso = today();
  const frequency = getCadenceDays();
  const people = db
    .select({ id: associates.id, name: associates.name, title: associates.title })
    .from(associates)
    .where(and(eq(associates.isDirectlyManaged, true), eq(associates.isActive, true)))
    .orderBy(asc(associates.name))
    .all();
  const entries = db.select({ associateId: cadenceEntries.associateId, occurredOn: cadenceEntries.occurredOn }).from(cadenceEntries).all();
  const open = db.select().from(actionItems).where(eq(actionItems.status, "OPEN")).all();
  return {
    frequency,
    rows: people.map((p) => {
      const mine = entries.filter((e) => e.associateId === p.id).map((e) => e.occurredOn).sort();
      const last = mine.at(-1) ?? null;
      return {
        ...p,
        lastOn: last,
        meetings: mine.length,
        ...cadenceStatus(last, todayIso, frequency),
        openMine: open.filter((i) => i.associateId === p.id && i.owner === "ME").length,
        openTheirs: open.filter((i) => i.associateId === p.id && i.owner === "ASSOCIATE").length,
      };
    }),
    myOpenItems: open
      .filter((i) => i.owner === "ME")
      .map((i) => ({ ...i, associateName: people.find((p) => p.id === i.associateId)?.name ?? null })),
  };
}

/* ------------------------------------------ Entries ------------------------------------------ */

export function listEntries(associateId: number): CadenceEntry[] {
  return db
    .select()
    .from(cadenceEntries)
    .where(eq(cadenceEntries.associateId, associateId))
    .orderBy(desc(cadenceEntries.occurredOn), desc(cadenceEntries.id))
    .all() as CadenceEntry[];
}

export function getEntry(id: number): CadenceEntry | undefined {
  return db.select().from(cadenceEntries).where(eq(cadenceEntries.id, id)).get() as CadenceEntry | undefined;
}

export function createEntry(associateId: number, occurredOn: string, notes: string): number {
  return db
    .insert(cadenceEntries)
    .values({ associateId, occurredOn, notes, analysisStatus: getAnthropicClient() ? "PENDING" : "NO_KEY" })
    .returning({ id: cadenceEntries.id })
    .get().id;
}

/** Returns whether the notes changed (and so need analyzing again). */
export function updateEntry(id: number, occurredOn: string, notes: string): boolean {
  const entry = getEntry(id);
  if (!entry) return false;
  const changed = entry.notes !== notes;
  db.update(cadenceEntries)
    .set({
      occurredOn,
      notes,
      updatedAt: new Date(),
      ...(changed ? { analysisStatus: getAnthropicClient() ? "PENDING" : "NO_KEY", analysisError: null } : {}),
    })
    .where(eq(cadenceEntries.id, id))
    .run();
  return changed;
}

/** Deletes the entry and the action items that came from it. */
export function deleteEntry(id: number) {
  db.transaction((tx) => {
    tx.delete(actionItems).where(and(eq(actionItems.sourceType, "CADENCE"), eq(actionItems.sourceId, id))).run();
    tx.delete(cadenceEntries).where(eq(cadenceEntries.id, id)).run();
  });
}

export function markPending(id: number) {
  db.update(cadenceEntries)
    .set({ analysisStatus: getAnthropicClient() ? "PENDING" : "NO_KEY", analysisError: null, updatedAt: new Date() })
    .where(eq(cadenceEntries.id, id))
    .run();
}

/**
 * Asks Claude for this entry's insight and stores it. Action items from the entry that you
 * have not touched are replaced; items you edited or completed are kept.
 */
export async function analyzeEntry(id: number): Promise<void> {
  const entry = getEntry(id);
  if (!entry) return;
  const anthropic = getAnthropicClient({ timeoutMs: 3 * 60_000, maxRetries: 1 });
  if (!anthropic) {
    db.update(cadenceEntries).set({ analysisStatus: "NO_KEY" }).where(eq(cadenceEntries.id, id)).run();
    return;
  }

  const previous = db
    .select({ occurredOn: cadenceEntries.occurredOn, notes: cadenceEntries.notes })
    .from(cadenceEntries)
    .where(and(eq(cadenceEntries.associateId, entry.associateId), lt(cadenceEntries.occurredOn, entry.occurredOn)))
    .orderBy(desc(cadenceEntries.occurredOn))
    .limit(3)
    .all();
  const openItems = db
    .select({ id: actionItems.id, text: actionItems.text, owner: actionItems.owner, sourceId: actionItems.sourceId })
    .from(actionItems)
    .where(and(eq(actionItems.associateId, entry.associateId), eq(actionItems.status, "OPEN")))
    .all()
    .filter((i) => i.sourceId !== id);
  const capabilityNames = db.select({ name: capabilities.name }).from(capabilities).orderBy(asc(capabilities.sortOrder)).all().map((c) => c.name);

  const model = getAiModel();
  const result = await requestInsight(anthropic, model, {
    occurredOn: entry.occurredOn,
    notes: entry.notes,
    previous,
    openItems: openItems.map(({ id: itemId, text, owner }) => ({ id: itemId, text, owner })),
    capabilityNames,
  });

  // The notes may have been edited again while Claude was working; only store a current answer.
  const current = getEntry(id);
  if (!current || current.notes !== entry.notes) return;

  if (!result.ok) {
    db.update(cadenceEntries)
      .set({ analysisStatus: "FAILED", analysisError: result.error, insightCostUsd: result.costUsd ?? null, analyzedAt: new Date() })
      .where(eq(cadenceEntries.id, id))
      .run();
    return;
  }
  const insight = result.output;
  db.transaction((tx) => {
    tx.delete(actionItems)
      .where(
        and(
          eq(actionItems.sourceType, "CADENCE"),
          eq(actionItems.sourceId, id),
          eq(actionItems.userEdited, false),
          eq(actionItems.status, "OPEN"),
        ),
      )
      .run();
    if (insight.action_items.length) {
      tx.insert(actionItems)
        .values(
          insight.action_items.map((a) => ({
            sourceType: "CADENCE" as const,
            sourceId: id,
            associateId: entry.associateId,
            text: a.text,
            owner: a.owner === "me" ? ("ME" as const) : ("ASSOCIATE" as const),
            dueHint: a.due_hint || null,
          })),
        )
        .run();
    }
    tx.update(cadenceEntries)
      .set({
        analysisStatus: "DONE",
        analysisError: null,
        insight,
        insightModel: result.servedModel,
        insightPromptVersion: INSIGHT_PROMPT_VERSION,
        insightCostUsd: result.costUsd,
        analyzedAt: new Date(),
      })
      .where(eq(cadenceEntries.id, id))
      .run();
  });
}

/* ---------------------------------------- Action items ---------------------------------------- */

export function listItems(associateId: number): ActionItem[] {
  return db
    .select()
    .from(actionItems)
    .where(eq(actionItems.associateId, associateId))
    .orderBy(asc(actionItems.status), desc(actionItems.createdAt))
    .all();
}

export function getItem(id: number): ActionItem | undefined {
  return db.select().from(actionItems).where(eq(actionItems.id, id)).get();
}

export function setItemStatus(id: number, status: ActionItem["status"]) {
  db.update(actionItems)
    .set({ status, userEdited: true, completedAt: status === "DONE" ? new Date() : null, updatedAt: new Date() })
    .where(eq(actionItems.id, id))
    .run();
}

export function updateItem(id: number, fields: { text: string; owner: ActionItem["owner"] }) {
  db.update(actionItems).set({ ...fields, userEdited: true, updatedAt: new Date() }).where(eq(actionItems.id, id)).run();
}

export function addManualItem(associateId: number, text: string, owner: ActionItem["owner"]) {
  db.insert(actionItems).values({ sourceType: "MANUAL", associateId, text, owner, userEdited: true }).run();
}

export function deleteItem(id: number) {
  db.delete(actionItems).where(eq(actionItems.id, id)).run();
}

/* ------------------------------------------- Trends ------------------------------------------- */

export function latestTrend(associateId: number): TrendReport | undefined {
  return db
    .select()
    .from(trendReports)
    .where(and(eq(trendReports.subjectType, "ASSOCIATE"), eq(trendReports.subjectId, associateId)))
    .orderBy(desc(trendReports.createdAt))
    .limit(1)
    .get() as TrendReport | undefined;
}

export class TrendError extends Error {}

/** Builds a trend report over the last `days` days of 1:1s. */
export async function generateTrend(associateId: number, days = 90): Promise<TrendReport> {
  const anthropic = getAnthropicClient({ timeoutMs: 5 * 60_000, maxRetries: 1 });
  if (!anthropic) throw new TrendError("Save a Claude API key in Settings first.");
  const periodEnd = today();
  const periodStart = addDays(periodEnd, -days);
  const meetings = db
    .select()
    .from(cadenceEntries)
    .where(and(eq(cadenceEntries.associateId, associateId), gte(cadenceEntries.occurredOn, periodStart), lte(cadenceEntries.occurredOn, periodEnd)))
    .orderBy(asc(cadenceEntries.occurredOn))
    .all() as CadenceEntry[];
  if (meetings.length < 2) throw new TrendError(`Trends need at least two 1:1s in the last ${days} days.`);

  const items = db
    .select({ status: actionItems.status })
    .from(actionItems)
    .where(and(eq(actionItems.sourceType, "CADENCE"), inArray(actionItems.sourceId, meetings.map((m) => m.id))))
    .all();
  const model = getAiModel();
  const result = await requestTrend(anthropic, model, {
    periodStart,
    periodEnd,
    meetings: meetings.map((m) => ({
      occurredOn: m.occurredOn,
      notes: m.notes,
      summary: m.insight?.summary ?? null,
      morale: m.insight?.morale.level ?? null,
    })),
    stats: itemStats(items),
  });
  return db
    .insert(trendReports)
    .values({
      subjectType: "ASSOCIATE",
      subjectId: associateId,
      periodStart,
      periodEnd,
      status: result.ok ? "DONE" : "FAILED",
      error: result.ok ? null : result.error,
      content: result.ok ? { ...result.output, stats: itemStats(items), meetings: meetings.length } : null,
      model,
      promptVersion: TREND_PROMPT_VERSION,
      costUsd: result.costUsd ?? null,
    })
    .returning()
    .get() as TrendReport;
}
