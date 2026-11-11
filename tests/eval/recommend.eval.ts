/**
 * Live recommendation scenarios. Each sends a scenario to Claude and checks the best team
 * against the scenario's expectations. Run after changing the prompt:
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run eval
 *
 * Optional: REX_EVAL_MODEL (default claude-opus-5-5). About 10 calls; typically a few
 * cents each on Claude Opus 5.5.
 */
import Anthropic from "@anthropic-ai/sdk";
import { afterAll, describe, expect, it } from "vitest";
import { buildPayload, requestRecommendation, validateTeams } from "@/lib/ai/recommend/core";
import { PROMPT_VERSION } from "@/lib/ai/recommend/prompt";
import { SCENARIOS, scenarioInput } from "../fixtures/scenarios";

const key = process.env.ANTHROPIC_API_KEY;
const model = process.env.REX_EVAL_MODEL ?? "claude-opus-5-5";
const report: string[] = [];
let totalCost = 0;

describe.skipIf(!key)(`recommendation scenarios (${PROMPT_VERSION}, ${model})`, () => {
  const client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 5 * 60_000 });

  for (const scenario of SCENARIOS) {
    it(scenario.name, async () => {
      const input = scenarioInput(scenario);
      const result = await requestRecommendation(client, model, buildPayload(input));
      totalCost += result.costUsd ?? 0;
      if (!result.ok) {
        report.push(`FAIL  ${scenario.name}: ${result.error}`);
        throw new Error(result.error);
      }
      const { teams, problems } = validateTeams(result.output, input);
      const best = teams[0];
      const failures: string[] = [...problems];
      if (!best) failures.push("no valid team");
      for (const t of scenario.expect.topSeat ?? []) {
        const pick = best?.members.find((m) => m.seat === t.seat)?.associateId;
        if (pick === undefined || !t.oneOf.includes(pick)) {
          failures.push(`best team put ${pick ?? "nobody"} in ${t.seat}, expected one of ${t.oneOf.join(", ")}`);
        }
      }
      for (const id of scenario.expect.never ?? []) {
        if (teams.some((tm) => tm.members.some((m) => m.associateId === id))) failures.push(`a team used associate ${id}`);
      }
      const cost = `$${result.costUsd.toFixed(3)}, ${(result.durationMs / 1000).toFixed(0)} s`;
      report.push(`${failures.length ? "FAIL" : "pass"}  ${scenario.name}${failures.length ? `: ${failures.join("; ")}` : ""}  (${cost})`);
      expect(failures).toEqual([]);
    });
  }

  afterAll(() => {
    console.log(
      `\nRecommendation scenarios, ${PROMPT_VERSION} on ${model}\n${report.join("\n")}\nEstimated total: $${totalCost.toFixed(2)}\n`,
    );
  });
});

it.skipIf(!!key)("needs ANTHROPIC_API_KEY to run", () => {
  console.log("Set ANTHROPIC_API_KEY to run the live recommendation scenarios.");
});
