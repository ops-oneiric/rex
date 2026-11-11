import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  cleanInsight,
  type Insight,
  insightMessage,
  itemStats,
  requestInsight,
  trendMessage,
} from "@/lib/ai/cadence/core";

const ctx = {
  occurredOn: "2026-11-10",
  notes: "Walked through ACM go-live prep. She owns the tax setup checklist by Friday.",
  previous: [{ occurredOn: "2026-10-27", notes: "Talked about workload." }],
  openItems: [
    { id: 7, text: "Send updated PTO calendar", owner: "ASSOCIATE" as const },
    { id: 9, text: "Book shadowing session", owner: "ME" as const },
  ],
  capabilityNames: ["Multi-State", "Complex Payroll"],
};

const raw: Insight = {
  summary: " Good prep session. ",
  action_items: [
    { text: "Finish tax setup checklist", owner: "associate", due_hint: "Friday" },
    { text: "   ", owner: "me", due_hint: "" },
  ],
  strengths: ["Organized", ""],
  weak_points: ["Hesitant to escalate"],
  skills: [
    { skill: "Tax setup", capability: "multi-state" },
    { skill: "Planning", capability: "Invented Capability" },
  ],
  themes: ["go-live", "workload", "confidence", "tax", "extra"],
  morale: { level: "positive", reason: "Upbeat" },
  follow_ups: [
    { item_id: 7, status: "done", evidence: "Sent it Monday" },
    { item_id: 999, status: "done", evidence: "Not a real item" },
  ],
};

describe("insightMessage", () => {
  it("includes the notes, earlier meetings, open items with ids and capability names", () => {
    const m = insightMessage(ctx);
    expect(m).toContain("## This meeting (2026-11-10)");
    expect(m).toContain("She owns the tax setup checklist");
    expect(m).toContain("### 2026-10-27");
    expect(m).toContain("[id 7] (associate) Send updated PTO calendar");
    expect(m).toContain("[id 9] (manager) Book shadowing session");
    expect(m).toContain("Multi-State, Complex Payroll");
  });

  it("clips very long notes", () => {
    expect(insightMessage({ ...ctx, notes: "x".repeat(25000) })).toContain("[...]");
  });
});

describe("cleanInsight", () => {
  const clean = cleanInsight(raw, ctx);

  it("drops empty items and trims text", () => {
    expect(clean.summary).toBe("Good prep session.");
    expect(clean.action_items).toHaveLength(1);
    expect(clean.strengths).toEqual(["Organized"]);
    expect(clean.themes).toHaveLength(4);
  });

  it("maps capabilities to known names only", () => {
    expect(clean.skills).toEqual([
      { skill: "Tax setup", capability: "Multi-State" },
      { skill: "Planning", capability: null },
    ]);
  });

  it("keeps follow-ups only for real open items", () => {
    expect(clean.follow_ups.map((f) => f.item_id)).toEqual([7]);
  });
});

describe("requestInsight", () => {
  it("uses medium effort and cleans the answer", async () => {
    let seen: Record<string, unknown> = {};
    const client = {
      beta: {
        messages: {
          parse: async (p: Record<string, unknown>) => {
            seen = p;
            return { stop_reason: "end_turn", parsed_output: raw, usage: { input_tokens: 900, output_tokens: 300 }, model: "claude-opus-5-5" };
          },
        },
      },
    } as unknown as Anthropic;
    const r = await requestInsight(client, "claude-opus-5-5", ctx);
    expect((seen.output_config as { effort: string }).effort).toBe("medium");
    expect(r.ok && r.output.follow_ups).toHaveLength(1);
  });
});

describe("trends", () => {
  it("computes follow-through from closed items only", () => {
    expect(itemStats([{ status: "DONE" }, { status: "DONE" }, { status: "DROPPED" }, { status: "OPEN" }])).toEqual({
      total: 4,
      done: 2,
      open: 1,
      dropped: 1,
      rate: 67,
    });
    expect(itemStats([{ status: "OPEN" }]).rate).toBeNull();
  });

  it("lists every meeting and the statistics", () => {
    const m = trendMessage({
      periodStart: "2026-08-12",
      periodEnd: "2026-11-10",
      meetings: [
        { occurredOn: "2026-10-27", notes: "n1", summary: "s1", morale: "neutral" },
        { occurredOn: "2026-11-10", notes: "n2", summary: null, morale: null },
      ],
      stats: { total: 4, done: 2, open: 1, dropped: 1, rate: 67 },
    });
    expect(m).toContain("2 meetings");
    expect(m).toContain("### 2026-10-27 (morale: neutral)");
    expect(m).toContain("Summary: s1");
    expect(m).toContain("67% of closed items were done");
  });
});

describe("cadenceStatus", () => {
  it("tracks the 1:1 rhythm against the expected frequency", async () => {
    const { cadenceStatus } = await import("@/lib/cadence/status");
    expect(cadenceStatus(null, "2026-11-11", 14)).toEqual({ status: "NEVER", daysSince: null });
    expect(cadenceStatus("2026-11-04", "2026-11-11", 14)).toEqual({ status: "ON_TRACK", daysSince: 7 });
    expect(cadenceStatus("2026-10-30", "2026-11-11", 14)).toEqual({ status: "DUE_SOON", daysSince: 12 });
    expect(cadenceStatus("2026-10-28", "2026-11-11", 14)).toEqual({ status: "DUE_SOON", daysSince: 14 });
    expect(cadenceStatus("2026-10-27", "2026-11-11", 14)).toEqual({ status: "OVERDUE", daysSince: 15 });
  });
});
