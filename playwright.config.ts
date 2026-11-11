import { defineConfig, devices } from "@playwright/test";

// The e2e suite runs against a production build with a throwaway database.
// Run `npm run build` first. CI does this in .github/workflows/ci.yml.
const PORT = 3100;
// A local stand-in for the Claude API (tests/e2e/mock-claude.mjs): no real calls, no cost.
export const MOCK_CLAUDE = "http://127.0.0.1:3199";
const env = {
  DATABASE_PATH: "./test-results/e2e.db",
  REX_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  REX_ADMIN_USERNAME: "admin",
  REX_ADMIN_PASSWORD: "violet crown ledger 42",
  COOKIE_SECURE: "false",
  ANTHROPIC_BASE_URL: MOCK_CLAUDE,
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-claude.mjs",
      url: `${MOCK_CLAUDE}/__last`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `rm -f ${env.DATABASE_PATH}* && node scripts/set-admin.mjs && npx next start -p ${PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      env,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

export const E2E_ADMIN = { username: env.REX_ADMIN_USERNAME, password: env.REX_ADMIN_PASSWORD };
