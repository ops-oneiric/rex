import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { buildPayload, requestRecommendation, type RecommendationOutput, userMessage, validateTeams } from "@/lib/ai/recommend/core";
import { SYSTEM_PROMPT } from "@/lib/ai/recommend/prompt";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { aliasFor } from "@/lib/privacy/alias";
import { SCENARIOS, scenarioInput } from "../fixtures/scenarios";

const team = (assignments: { seat: string; associate: string }[]) => ({
  assignments,
  fit_score: 88.4,
  rationale: "r",
  factors: { pto: "", collisions: "", capacity: "", capability: "", time_zone: "" },
  risks: [],
  confidence: "high" as const,
});

describe("buildPayload", () => {
  it("never contains real names or codes", () => {
    for (const s of SCENARIOS) {
      const message = userMessage(buildPayload(scenarioInput(s)));
      for (const p of s.people) expect(message, s.name).not.toContain(p.name);
      expect(message).not.toContain("TST");
      expect(message).not.toContain("Test Client");
    }
  });

  it("lists knocked-out candidates only as excluded", () => {
    const input = scenarioInput(SCENARIOS[0]!);
    const payload = buildPayload(input);
    const payroll = payload.open_seats.find((s) => s.seat === "PAYROLL_1")!;
    const expert = aliasFor(input.map, "ASSOC", 1);
    expect(payroll.candidates.map((c) => c.associate)).not.toContain(expert);
    expect(payroll.excluded.map((c) => c.associate)).toContain(expert);
  });

  it("scrubs capability notes and client notes", () => {
    const s = { ...SCENARIOS[3]!, client: { ...SCENARIOS[3]!.client, notes: "Call Union Expert at 555-123-4567." } };
    const message = userMessage(buildPayload(scenarioInput(s)));
    expect(message).not.toContain("Union Expert");
    expect(message).toContain("[REDACTED_PHONE]");
  });

  it("keeps the system prompt free of per-request content so it caches", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("validateTeams", () => {
  const input = scenarioInput(SCENARIOS[0]!); // Traditional: PM + PAYROLL_1; id 1 knocked out
  const a = (id: number) => aliasFor(input.map, "ASSOC", id);
  const output = (teams: ReturnType<typeof team>[]): RecommendationOutput => ({ summary: "s", teams: teams as never, cautions: [] });

  it("accepts a complete team and rounds the score", () => {
    const r = validateTeams(output([team([{ seat: "PM", associate: a(3) }, { seat: "PAYROLL_1", associate: a(2) }])]), input);
    expect(r.problems).toEqual([]);
    expect(r.teams[0]!.members).toEqual([
      { seat: "PM", associateId: 3 },
      { seat: "PAYROLL_1", associateId: 2 },
    ]);
    expect(r.teams[0]!.fit_score).toBe(88);
  });

  it("sets aside teams that break the rules", () => {
    const r = validateTeams(
      output([
        team([{ seat: "PM", associate: a(3) }]),
        team([{ seat: "PM", associate: a(3) }, { seat: "PAYROLL_1", associate: a(1) }]),
        team([{ seat: "PM", associate: a(3) }, { seat: "PAYROLL_1", associate: "ASSOC_99" }]),
        team([{ seat: "PM", associate: a(2) }, { seat: "PAYROLL_1", associate: a(2) }]),
      ]),
      input,
    );
    expect(r.teams).toHaveLength(0);
    expect(r.problems).toHaveLength(3); // only the first three are considered
    expect(r.problems[0]).toMatch(/PAYROLL_1 is missing/);
    expect(r.problems[1]).toMatch(/excluded/);
    expect(r.problems[2]).toMatch(/not a candidate/);
  });
});

describe("requestRecommendation", () => {
  const payload = buildPayload(scenarioInput(SCENARIOS[1]!));
  const fake = (response: unknown) =>
    ({ beta: { messages: { parse: async (params: Record<string, unknown>) => ({ ...(response as object), _params: params }) } } }) as unknown as Anthropic;
  const usage = { input_tokens: 4000, output_tokens: 1000, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 };

  it("returns the parsed output with usage and cost", async () => {
    const parsed = { summary: "s", teams: [], cautions: [] };
    const r = await requestRecommendation(fake({ stop_reason: "end_turn", parsed_output: parsed, usage, model: "claude-opus-5-5" }), "claude-opus-5-5", payload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toEqual(parsed);
      expect(r.costUsd).toBeCloseTo(estimateCostUsd("claude-opus-5-5", usage));
    }
  });

  it("sends fallbacks and effort, but no fallbacks for Haiku", async () => {
    let seen: Record<string, unknown> = {};
    const capture = { beta: { messages: { parse: async (p: Record<string, unknown>) => ((seen = p), { stop_reason: "end_turn", parsed_output: { summary: "", teams: [], cautions: [] }, usage, model: "m" }) } } } as unknown as Anthropic;
    await requestRecommendation(capture, "claude-opus-5-5", payload);
    expect(seen.fallbacks).toBe("default");
    expect(seen.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect((seen.output_config as { effort: string }).effort).toBe("high");
    await requestRecommendation(capture, "claude-haiku-5-5", payload);
    expect(seen.fallbacks).toBeUndefined();
  });

  it("explains refusals, cut-off answers and unreadable output", async () => {
    const r1 = await requestRecommendation(fake({ stop_reason: "refusal", parsed_output: null, usage, model: "m" }), "claude-opus-5-5", payload);
    const r2 = await requestRecommendation(fake({ stop_reason: "max_tokens", parsed_output: null, usage, model: "m" }), "claude-opus-5-5", payload);
    const r3 = await requestRecommendation(fake({ stop_reason: "end_turn", parsed_output: null, usage, model: "m" }), "claude-opus-5-5", payload);
    expect([r1, r2, r3].map((r) => (r.ok ? "ok" : r.error))).toEqual([
      "Claude declined to answer this request.",
      "Claude's answer was cut off before it finished.",
      "Claude's answer could not be read.",
    ]);
  });

  it("turns API errors into plain messages", async () => {
    const failing = { beta: { messages: { parse: async () => { throw new Error("boom"); } } } } as unknown as Anthropic;
    const r = await requestRecommendation(failing, "claude-opus-5-5", payload);
    expect(r.ok ? "" : r.error).toBe("Unexpected error while asking Claude.");
  });
});

describe("scenarios", () => {
  it("are consistent with the rules engine", () => {
    for (const s of SCENARIOS) {
      const input = scenarioInput(s);
      for (const id of s.expect.never ?? []) {
        for (const seat of input.openSeats) {
          const c = seat.candidates.find((x) => x.associateId === id);
          // "never" people are either excluded by rules or already on the team.
          expect(c?.status === "eligible" && !(s.fixed ?? []).some((f) => f.associateId === id), `${s.name}: ${id} in ${seat.seat}`).toBe(false);
        }
      }
      for (const t of s.expect.topSeat ?? []) {
        const seat = input.openSeats.find((x) => x.seat === t.seat)!;
        expect(seat.candidates.some((c) => t.oneOf.includes(c.associateId) && c.status === "eligible"), s.name).toBe(true);
      }
    }
  });
});
