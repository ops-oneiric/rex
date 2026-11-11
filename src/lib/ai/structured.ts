/**
 * One structured-output call to Claude, shared by every AI feature in Rex: team
 * recommendations, 1:1 insights and trend reports. Handles the refusal fallback, stop
 * reasons, usage and cost, and turns API errors into plain messages. No database access.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { estimateCostUsd } from "./pricing";

export type StructuredResult<T> =
  | {
      ok: true;
      output: T;
      servedModel: string;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
      costUsd: number;
      durationMs: number;
    }
  | { ok: false; error: string; durationMs: number; costUsd?: number };

/** Models with a server-side refusal fallback. Haiku has none and rejects the parameter. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-fable-5-2", "claude-sonnet-5-5"]);

export async function callStructured<S extends z.ZodType>(
  client: Anthropic,
  request: {
    model: string;
    system: string;
    user: string;
    schema: S;
    effort: "low" | "medium" | "high";
    maxTokens?: number;
  },
): Promise<StructuredResult<z.infer<S>>> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  try {
    const response = await client.beta.messages.parse({
      model: request.model,
      max_tokens: request.maxTokens ?? 16000,
      ...(FALLBACK_MODELS.has(request.model)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
      // The system prompt never varies per request, so it is cached between calls.
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: request.user }],
      output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
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
      output: response.parsed_output as z.infer<S>,
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
