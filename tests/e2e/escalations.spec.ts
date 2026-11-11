import { expect, type Page, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

// Uses the local Claude stand-in (tests/e2e/mock-claude.mjs) and the API key saved in auth.spec.
test.describe.configure({ mode: "serial" });

async function logEscalation(page: Page, daysAgo: number, details: string) {
  await page.goto("/escalations");
  await page.getByLabel("Date").fill(isoInDays(-daysAgo));
  await page.getByLabel("Details").fill(details);
  await page.getByRole("button", { name: "Save escalation" }).click();
  await expect(page.getByRole("heading", { name: /^Escalation,/, level: 1 })).toBeVisible();
  // Claude's suggestion arrives in the background and prefills the review.
  await expect(page.getByText(/Prefilled with Claude's suggestions/)).toBeVisible({ timeout: 20_000 });
}

test("log, preview, review, confirm and resolve escalations; see trends", async ({ page }) => {
  await signIn(page, "/associates/new");
  await page.getByLabel("Name").fill("Esme Payroll");
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByRole("heading", { name: "Esme Payroll", level: 1 })).toBeVisible();
  await page.goto("/clients/new");
  await page.getByLabel("Company code").fill("ESC");
  await page.getByLabel("Name (optional)").fill("Escrow Corp");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: /ESC/, level: 1 })).toBeVisible();

  const details = "ESC called upset: Esme Payroll keyed the old rate table and 12 employees at Escrow Corp were paid short. HR contact is hr@escrow.example.";

  // Preview shows exactly what would be sent: codes, not names.
  await page.goto("/escalations");
  await page.getByLabel("Details").fill(details);
  await page.getByRole("button", { name: "Preview what will be sent" }).click();
  const preview = page.getByLabel("What Claude will receive");
  await expect(preview).toContainText("CLIENT_");
  await expect(preview).toContainText("ASSOC_");
  await expect(preview).toContainText("[REDACTED_EMAIL]");
  for (const secret of ["Esme", "Escrow", "ESC ", "hr@escrow"]) await expect(preview).not.toContainText(secret);

  await logEscalation(page, 3, details);

  // The review is prefilled with Claude's reading, decoded to real names.
  await expect(page.getByLabel("Client", { exact: true })).toHaveValue(/\d+/);
  await expect(page.getByLabel("Client", { exact: true }).locator("option:checked")).toHaveText("ESC · Escrow Corp");
  await expect(page.getByLabel("Severity")).toHaveValue("HIGH");
  await expect(page.getByLabel("Fault", { exact: true })).toHaveValue("ASSOCIATE");
  await expect(page.getByLabel("Esme Payroll at fault")).toBeChecked();
  await expect(page.getByLabel("Why fault was aligned this way")).toHaveValue("Esme Payroll keyed the old rate table.");
  const received = page.locator("pre");
  await expect(received).not.toContainText("Esme Payroll");
  await expect(received).toContainText("[REDACTED_EMAIL]");

  // Confirm with one of the two suggested actions.
  await page.getByLabel("Create action item: Walk through the corrected rates with the client").uncheck();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Confirmed. It now counts in escalation trends.")).toBeVisible();
  await expect(page.getByText("Add a rate table check to the go-live checklist")).toBeVisible();
  await expect(page.getByText("Walk through the corrected rates with the client")).toHaveCount(0);

  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

  // A second one, confirmed as is.
  await logEscalation(page, 1, "Esme Payroll missed the ESC garnishment change; two employees affected.");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Confirmed. It now counts in escalation trends.")).toBeVisible();

  // The log lists both, with filters.
  await page.goto("/escalations");
  await expect(page.getByRole("link", { name: /^\w{3} \d{1,2}, \d{4}$/ })).toHaveCount(2);
  await page.getByLabel("Filter by status").selectOption("OPEN");
  await expect(page.getByRole("link", { name: /^\w{3} \d{1,2}, \d{4}$/ })).toHaveCount(1);

  // Trends: exact counts plus Claude's reading.
  await page.getByRole("link", { name: "Trends" }).click();
  await expect(page.getByText("Confirmed escalations", { exact: true }).locator("..").locator("..")).toContainText("2");
  await expect(page.getByRole("listitem", { name: /^Associate: 2/ })).toBeVisible();
  await page.getByRole("button", { name: "Analyze patterns" }).click();
  await expect(page.getByText("Suggested process fixes")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Add a rate table check before every first payroll")).toBeVisible();

  // The associate and client pages show them.
  await page.goto("/associates");
  await page.getByRole("link", { name: "Esme Payroll" }).click();
  await page.getByRole("navigation", { name: "Associate sections" }).getByRole("link", { name: /Escalations/ }).click();
  await expect(page.getByText("2 confirmed escalations involving them, 2 with fault confirmed as theirs.")).toBeVisible();
  await page.goto("/clients");
  await page.getByLabel("Filter by stage").selectOption("all");
  await page.getByRole("link", { name: "ESC", exact: true }).click();
  await expect(page.getByText("2 confirmed escalations.")).toBeVisible();

  // Delete one.
  await page.goto("/escalations");
  await page.getByRole("link", { name: /^\w{3} \d{1,2}, \d{4}$/ }).first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete escalation" }).click();
  await expect(page).toHaveURL(/\/escalations$/);
  await expect(page.getByRole("link", { name: /^\w{3} \d{1,2}, \d{4}$/ })).toHaveCount(1);
});
