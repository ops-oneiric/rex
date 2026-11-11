/**
 * 1:1 insights and associate trend reports. Free of database access so it can be tested.
 * Per your decision (D7), 1:1 notes are sent as written; the associate is never named by
 * Rex in these requests.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { callStructured, type StructuredResult } from "../structured";

/* ------------------------------------------ Insight ------------------------------------------ */

export const INSIGHT_PROMPT_VERSION = "insight-v1";

export const INSIGHT_SYSTEM = `You help a manager get more out of their 1:1 meetings with the payroll implementation associates they manage. You receive the manager's notes from one meeting, a few earlier meetings for context, the action items still open, and the capability names the manager rates associates on.

Extract, from this meeting's notes only:
- summary: 2 to 4 sentences a busy manager can scan.
- action_items: concrete next steps that were agreed or are clearly needed. owner "me" is the manager, "associate" is the associate. due_hint is any timing mentioned ("before Friday", "next 1:1"), or an empty string.
- strengths and weak_points: specific, observable, and fair. Weak points are growth areas, phrased constructively.
- skills: skills the associate demonstrated. Set "capability" to the matching name from the provided list when one clearly fits, otherwise null.
- themes: 1 to 4 short tags (for example "workload", "client communication", "confidence").
- morale: positive, neutral or concerned, with a one-line reason grounded in the notes.
- follow_ups: for each open action item the notes show progress on, its id and whether it looks done, still open, or no longer relevant, with the evidence. Leave out items the notes do not mention.

Use only what the notes support; do not invent details. If the notes are thin, return fewer items rather than padding. Write in plain, professional English.`;

export const insightSchema = z.object({
  summary: z.string(),
  action_items: z.array(z.object({ text: z.string(), owner: z.enum(["me", "associate"]), due_hint: z.string() })),
  strengths: z.array(z.string()),
  weak_points: z.array(z.string()),
  skills: z.array(z.object({ skill: z.string(), capability: z.string().nullable() })),
  themes: z.array(z.string()),
  morale: z.object({ level: z.enum(["positive", "neutral", "concerned"]), reason: z.string() }),
  follow_ups: z.array(
    z.object({ item_id: z.number(), status: z.enum(["done", "still_open", "no_longer_relevant"]), evidence: z.string() }),
  ),
});

export type Insight = z.infer<typeof insightSchema>;

export type InsightContext = {
  occurredOn: string;
  notes: string;
  previous: { occurredOn: string; notes: string }[];
  openItems: { id: number; text: string; owner: "ME" | "ASSOCIATE" }[];
  capabilityNames: string[];
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n[...]` : text);

export function insightMessage(ctx: InsightContext): string {
  const previous = ctx.previous.length
    ? ctx.previous.map((p) => `### ${p.occurredOn}\n${clip(p.notes, 3000)}`).join("\n\n")
    : "None.";
  const items = ctx.openItems.length
    ? ctx.openItems.map((i) => `- [id ${i.id}] (${i.owner === "ME" ? "manager" : "associate"}) ${i.text}`).join("\n")
    : "None.";
  return [
    `## This meeting (${ctx.occurredOn})`,
    clip(ctx.notes, 20000),
    "## Earlier meetings, most recent first",
    previous,
    "## Open action items",
    items,
    "## Capability names",
    ctx.capabilityNames.join(", ") || "None.",
  ].join("\n\n");
}

/** Drops follow-ups for unknown items, unknown capability names, empty strings and excess. */
export function cleanInsight(insight: Insight, ctx: Pick<InsightContext, "openItems" | "capabilityNames">): Insight {
  const ids = new Set(ctx.openItems.map((i) => i.id));
  const caps = new Map(ctx.capabilityNames.map((c) => [c.toLowerCase(), c]));
  const text = (xs: string[], max: number) => xs.map((x) => x.trim()).filter(Boolean).slice(0, max);
  return {
    summary: insight.summary.trim(),
    action_items: insight.action_items
      .map((a) => ({ ...a, text: a.text.trim(), due_hint: a.due_hint.trim() }))
      .filter((a) => a.text)
      .slice(0, 12),
    strengths: text(insight.strengths, 8),
    weak_points: text(insight.weak_points, 8),
    skills: insight.skills
      .filter((s) => s.skill.trim())
      .map((s) => ({ skill: s.skill.trim(), capability: s.capability ? caps.get(s.capability.toLowerCase()) ?? null : null }))
      .slice(0, 10),
    themes: text(insight.themes, 4),
    morale: { level: insight.morale.level, reason: insight.morale.reason.trim() },
    follow_ups: insight.follow_ups.filter((f) => ids.has(f.item_id)),
  };
}

export async function requestInsight(client: Anthropic, model: string, ctx: InsightContext): Promise<StructuredResult<Insight>> {
  const result = await callStructured(client, {
    model,
    system: INSIGHT_SYSTEM,
    user: insightMessage(ctx),
    schema: insightSchema,
    effort: "medium",
  });
  return result.ok ? { ...result, output: cleanInsight(result.output, ctx) } : result;
}

/* ------------------------------------------- Trends ------------------------------------------- */

export const TREND_PROMPT_VERSION = "trend-v1";

export const TREND_SYSTEM = `You help a manager see patterns across their 1:1 meetings with one payroll implementation associate. You receive every meeting in a period (the manager's notes plus a short summary and morale reading for each), and action item statistics calculated exactly in code.

Return:
- overview: 2 to 4 sentences on how this associate is doing over the period.
- recurring_themes: topics that come up in more than one meeting, each with a short detail.
- skill_growth: skills that are clearly developing, with evidence.
- persistent_weak_points: growth areas that recur or have not improved.
- morale_trajectory: improving, steady, declining, mixed or unclear, with a short explanation.
- follow_through: one or two sentences on how reliably action items get done, using the statistics as given.
- talking_points: 3 to 5 specific, constructive things to raise at the next 1:1.

Base everything on the meetings provided. If there are too few meetings for a pattern, say so instead of guessing. Write in plain, professional English.`;

export const trendSchema = z.object({
  overview: z.string(),
  recurring_themes: z.array(z.object({ theme: z.string(), detail: z.string() })),
  skill_growth: z.array(z.string()),
  persistent_weak_points: z.array(z.string()),
  morale_trajectory: z.object({
    direction: z.enum(["improving", "steady", "declining", "mixed", "unclear"]),
    detail: z.string(),
  }),
  follow_through: z.string(),
  talking_points: z.array(z.string()),
});

export type Trend = z.infer<typeof trendSchema>;

export type ItemStats = { total: number; done: number; open: number; dropped: number; rate: number | null };

/** Follow-through: done out of items that are no longer open. Null when nothing has closed. */
export function itemStats(items: { status: "OPEN" | "DONE" | "DROPPED" }[]): ItemStats {
  const done = items.filter((i) => i.status === "DONE").length;
  const dropped = items.filter((i) => i.status === "DROPPED").length;
  const open = items.filter((i) => i.status === "OPEN").length;
  const closed = done + dropped;
  return { total: items.length, done, open, dropped, rate: closed ? Math.round((done / closed) * 100) : null };
}

export type TrendContext = {
  periodStart: string;
  periodEnd: string;
  meetings: { occurredOn: string; notes: string; summary: string | null; morale: string | null }[];
  stats: ItemStats;
};

export function trendMessage(ctx: TrendContext): string {
  const meetings = ctx.meetings
    .map(
      (m) =>
        `### ${m.occurredOn}${m.morale ? ` (morale: ${m.morale})` : ""}\n${m.summary ? `Summary: ${m.summary}\n` : ""}Notes:\n${clip(m.notes, 4000)}`,
    )
    .join("\n\n");
  const s = ctx.stats;
  return [
    `## Period ${ctx.periodStart} to ${ctx.periodEnd}: ${ctx.meetings.length} meeting${ctx.meetings.length === 1 ? "" : "s"}`,
    meetings || "No meetings.",
    "## Action items from these meetings",
    `${s.total} total: ${s.done} done, ${s.open} open, ${s.dropped} dropped.${s.rate === null ? "" : ` ${s.rate}% of closed items were done.`}`,
  ].join("\n\n");
}

export async function requestTrend(client: Anthropic, model: string, ctx: TrendContext): Promise<StructuredResult<Trend>> {
  return callStructured(client, { model, system: TREND_SYSTEM, user: trendMessage(ctx), schema: trendSchema, effort: "high" });
}
