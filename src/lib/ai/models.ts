export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Recommended. Best balance of reasoning and cost." },
  { id: "claude-fable-5-2", label: "Claude Fable 5.2", note: "Most capable, about twice the cost of Opus." },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Faster and cheaper, slightly less thorough." },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fastest and cheapest, for simple tasks." },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: ModelId = "claude-opus-5-5";

export function isSupportedModel(value: string): value is ModelId {
  return MODELS.some((m) => m.id === value);
}
