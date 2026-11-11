import type { ModelId } from "./models";

/** List prices in USD per million tokens (input, output). Cache writes cost 1.25x input, reads 0.1x. */
const PRICES: Record<ModelId, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-fable-5-2": [8, 40],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Estimated cost of one call. An estimate: fallbacks or price changes can differ. */
export function estimateCostUsd(model: string, usage: Usage): number {
  const [inPrice, outPrice] = PRICES[model as ModelId] ?? PRICES["claude-opus-5-5"];
  const m = 1_000_000;
  return (
    (usage.input_tokens * inPrice +
      (usage.cache_creation_input_tokens ?? 0) * inPrice * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * inPrice * 0.1 +
      usage.output_tokens * outPrice) /
    m
  );
}
