/**
 * Building the coded request, calling Claude and validating its answer. Free of database
 * access so it can be unit-tested and reused by the evaluation scenarios.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Evaluation, RuleClient } from "@/lib/assignments/rules";
import { SEATS, type Seat } from "@/lib/assignments/seats";
import { aliasFor, type AliasMap, type PrivacySubjects, scrubText } from "@/lib/privacy/alias";
import { estimateCostUsd } from "../pricing";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt";

/* ----------------------------------------- Output ----------------------------------------- */

// No numeric or length constraints here: structured outputs do not support them.
// Ranges are checked in validateTeams instead.
export const recommendationSchema = z.object({
  summary: z.string(),
  teams: z.array(
    z.object({
      assignments: z.array(z.object({ seat: z.enum(SEATS), associate: z.string() })),
      fit_score: z.number(),
      rationale: z.string(),
      factors: z.object({
        pto: z.string(),
        collisions: z.string(),
        capacity: z.string(),
        capability: z.string(),
        time_zone: z.string(),
      }),
      risks: z.array(z.string()),
      confidence: z.enum(["low", "medium", "high"]),
    }),
  ),
  cautions: z.array(z.string()),
});

export type RecommendationOutput = z.infer<typeof recommendationSchema>;
export type RecommendedTeam = RecommendationOutput["teams"][number];

/* ------------------------------------------ Input ------------------------------------------ */

export type SeatCandidates = { seat: Seat; candidates: Evaluation[] };

export type RecommendationInput = {
  client: RuleClient & { notes: string; needs: string[]; businessDaysToFirstInput: number | null; label: string };
  openSeats: SeatCandidates[];
  fixedMembers: { seat: Seat; associateId: number }[];
  /** Capability levels and notes per associate id (all capabilities, not only needs). */
  associateProfiles: Map<number, { capabilities: Record<string, number>; notes: string; timeZone: string; targetLoad: number }>;
  subjects: PrivacySubjects;
  map: AliasMap;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The exact JSON Claude receives: aliases only, with free text scrubbed. */
export function buildPayload(input: RecommendationInput) {
  const { client, map, subjects } = input;
  const scrub = (t: string) => scrubText(t, subjects, map);
  const describe = (e: Evaluation) => {
    const profile = input.associateProfiles.get(e.associateId);
    return {
      associate: aliasFor(map, "ASSOC", e.associateId),
      score: e.score,
      load_now: round1(e.load.projected),
      load_after: round1(e.loadAfter),
      target_load: e.targetLoad,
      load_band_after: e.bandAfter,
      accounts: e.load.accounts,
      flags: e.flags.map((f) => ({ level: f.level, text: scrub(f.text) })),
      collisions: e.collisions.map((c) => ({
        client: aliasFor(map, "CLIENT", c.clientId),
        first_input: c.firstInputDate,
        business_days_apart: c.businessDaysApart,
        level: c.level,
      })),
      needs_fit: e.needs.map((n) => ({ need: n.name, level: n.level })),
      time_zone: profile?.timeZone,
      hours_from_client: e.timeZoneHours,
      similar_accounts: e.experience,
      capabilities: profile?.capabilities ?? {},
      capability_notes: profile?.notes ? scrub(profile.notes) : "",
    };
  };

  return {
    client: {
      client: aliasFor(map, "CLIENT", client.id),
      stage: client.lifecycleStage,
      support_model: client.supportModel,
      implementation_type: client.implementationType,
      previous_vendor: client.previousVendor,
      employee_count: client.employeeCount,
      control_count: client.controlCount,
      payroll_complexity_1_to_5: client.payrollComplexity,
      first_input_date: client.firstInputDate,
      business_days_to_first_input: client.businessDaysToFirstInput,
      benefits_start_date: client.benefitsStartDate,
      time_zone: client.timeZone,
      fast_start: client.isFastStart,
      workload_weight: client.weight,
      needs: client.needs,
      notes: client.notes ? scrub(client.notes) : "",
    },
    fixed_members: input.fixedMembers.map((m) => ({ seat: m.seat, associate: aliasFor(map, "ASSOC", m.associateId) })),
    open_seats: input.openSeats.map((s) => ({
      seat: s.seat,
      candidates: s.candidates.filter((c) => c.status === "eligible").map(describe),
      excluded: s.candidates
        .filter((c) => c.status === "knocked_out")
        .map((c) => ({ associate: aliasFor(map, "ASSOC", c.associateId), reasons: c.reasons.map(scrub) })),
    })),
  };
}

export function userMessage(payload: ReturnType<typeof buildPayload>): string {
  return `Recommend teams for this client. Facts:\n\n${JSON.stringify(payload, null, 2)}`;
}

/* ---------------------------------------- Validation ---------------------------------------- */

export type ValidTeam = RecommendedTeam & { members: { seat: Seat; associateId: number }[] };

/**
 * Keeps teams that fill every open seat with a distinct eligible candidate. Problems with
 * dropped teams are returned as notes rather than thrown, so one bad team does not lose the rest.
 */
export type SeatChoices = { seat: Seat; candidates: Pick<Evaluation, "associateId" | "status">[] }[];

export function validateTeams(
  output: RecommendationOutput,
  input: { openSeats: SeatChoices; fixedMembers: RecommendationInput["fixedMembers"]; map: AliasMap },
): { teams: ValidTeam[]; problems: string[] } {
  const problems: string[] = [];
  const teams: ValidTeam[] = [];
  const fixed = new Set(input.fixedMembers.map((m) => m.associateId));

  output.teams.slice(0, 3).forEach((team, i) => {
    const members: { seat: Seat; associateId: number }[] = [];
    const issues: string[] = [];
    for (const open of input.openSeats) {
      const pick = team.assignments.filter((a) => a.seat === open.seat);
      if (pick.length !== 1) {
        issues.push(`seat ${open.seat} is ${pick.length ? "filled twice" : "missing"}`);
        continue;
      }
      const entry = input.map.entries.find((e) => e.kind === "ASSOC" && e.alias === pick[0]!.associate);
      const candidate = entry && open.candidates.find((c) => c.associateId === entry.id);
      if (!entry || !candidate) issues.push(`${pick[0]!.associate} is not a candidate for ${open.seat}`);
      else if (candidate.status !== "eligible") issues.push(`${pick[0]!.associate} is excluded from ${open.seat}`);
      else members.push({ seat: open.seat, associateId: entry.id });
    }
    const ids = members.map((m) => m.associateId);
    if (new Set(ids).size !== ids.length) issues.push("the same associate fills two seats");
    if (ids.some((id) => fixed.has(id))) issues.push("an associate already on the team was proposed again");
    if (team.assignments.some((a) => !input.openSeats.some((s) => s.seat === a.seat))) issues.push("it changes a seat that is already filled");

    if (issues.length) problems.push(`Suggestion ${i + 1} was set aside: ${issues.join("; ")}.`);
    else teams.push({ ...team, fit_score: Math.max(0, Math.min(100, Math.round(team.fit_score))), members });
  });
  return { teams, problems };
}

/* ------------------------------------------ Calling ------------------------------------------ */

export type CallResult =
  | {
      ok: true;
      output: RecommendationOutput;
      servedModel: string;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
      costUsd: number;
      durationMs: number;
    }
  | { ok: false; error: string; durationMs: number; costUsd?: number };

/** Models with a server-side refusal fallback. Haiku has none and rejects the parameter. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-fable-5-2", "claude-sonnet-5-5"]);

export async function requestRecommendation(
  client: Anthropic,
  model: string,
  payload: ReturnType<typeof buildPayload>,
): Promise<CallResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...(FALLBACK_MODELS.has(model)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage(payload) }],
      output_config: { effort: "high", format: betaZodOutputFormat(recommendationSchema) },
    });
    const usage = response.usage;
    const costUsd = estimateCostUsd(response.model, usage);
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "Claude declined to answer this request.", durationMs: elapsed(), costUsd };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "Claude's answer was cut off before it finished.", durationMs: elapsed(), costUsd };
    }
    if (!response.parsed_output) {
      return { ok: false, error: "Claude's answer could not be read.", durationMs: elapsed(), costUsd };
    }
    return {
      ok: true,
      output: response.parsed_output,
      servedModel: response.model,
      usage: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,
      },
      costUsd,
      durationMs: elapsed(),
    };
  } catch (error) {
    return { ok: false, error: describeApiError(error), durationMs: elapsed() };
  }
}

export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The API key was rejected. Check it in Settings.";
  if (error instanceof Anthropic.PermissionDeniedError) return "This API key does not have permission for this request.";
  if (error instanceof Anthropic.NotFoundError) return "The chosen model is not available to this API key. Pick another in Settings.";
  if (error instanceof Anthropic.RateLimitError) return "Rate limited by the API. Wait a minute and try again.";
  if (error instanceof Anthropic.APIConnectionError) return "Could not reach the Claude API from this server.";
  if (error instanceof Anthropic.BadRequestError) return `The API rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `The API returned an error (status ${error.status ?? "unknown"}).`;
  return "Unexpected error while asking Claude.";
}

export { PROMPT_VERSION };
