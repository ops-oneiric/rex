import path from "node:path";
import { defineConfig } from "vitest/config";

// Live evaluation against the Claude API. Costs money; run on demand with `npm run eval`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/eval/**/*.eval.ts"],
    environment: "node",
    testTimeout: 5 * 60_000,
    // One scenario at a time keeps rate limits and the report readable.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
