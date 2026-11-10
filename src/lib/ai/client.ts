import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/settings";

/** Anthropic client using the key saved in Settings, or null if none is saved. */
export function getAnthropicClient(options: { timeoutMs?: number; maxRetries?: number } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new Anthropic({
    apiKey,
    timeout: options.timeoutMs ?? 60_000,
    maxRetries: options.maxRetries ?? 2,
  });
}

export type ConnectionResult = { ok: true; message: string } | { ok: false; message: string };

/** Checks the saved key by looking up the chosen model. Costs no tokens. */
export async function testConnection(model: string): Promise<ConnectionResult> {
  const client = getAnthropicClient({ timeoutMs: 15_000, maxRetries: 0 });
  if (!client) return { ok: false, message: "No API key is saved yet." };

  try {
    const info = await client.models.retrieve(model);
    return { ok: true, message: `Connected. ${info.display_name} is available to this key.` };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, message: "The API key was rejected. Check that it was copied in full." };
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, message: "This key does not have permission to use the API." };
    }
    if (error instanceof Anthropic.NotFoundError) {
      return { ok: false, message: `The key works, but ${model} is not available to it.` };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, message: "Rate limited by the API. Try again in a minute." };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { ok: false, message: "Could not reach the Claude API from this server." };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, message: `The API returned an error (status ${error.status ?? "unknown"}).` };
    }
    return { ok: false, message: "Unexpected error while testing the connection." };
  }
}
