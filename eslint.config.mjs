import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Rex uses line icons only. Fail the build if an emoji appears in source text.
const EMOJI = "/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}]/u";
const emojiMessage = "Do not use emojis in Rex. Use a lucide-react icon instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${EMOJI}]`, message: emojiMessage },
        { selector: `JSXText[value=${EMOJI}]`, message: emojiMessage },
        { selector: `TemplateElement[value.raw=${EMOJI}]`, message: emojiMessage },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**", "test-results/**", "playwright-report/**"]),
]);

export default eslintConfig;
