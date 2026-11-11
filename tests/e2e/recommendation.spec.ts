import { expect, type Page, test } from "@playwright/test";
import { MOCK_CLAUDE } from "../../playwright.config";
import { isoInDays, signIn } from "./helpers";

// Uses the local Claude stand-in (tests/e2e/mock-claude.mjs). Runs after clients.spec.
test.describe.configure({ mode: "serial" });

async function addAssociate(page: Page, name: string, seats: { pm: boolean; payroll: boolean }, notes?: string) {
  await page.goto("/associates/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.locator('input[name="canPm"]').setChecked(seats.pm);
  await page.locator('input[name="canPayroll"]').setChecked(seats.payroll);
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  if (notes) {
    await page.getByLabel("Capability notes").fill(notes);
    await page.getByRole("button", { name: "Save capabilities" }).click();
    await expect(page.getByText("Capabilities saved.")).toBeVisible();
  }
}

test("Claude recommends a team; nothing identifying is sent; accepting assigns it", async ({ page }) => {
  await signIn(page, "/settings?tab=claude");
  await page.getByLabel(/API key/).fill("sk-ant-e2e-fake-key-for-the-mock-0000");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText(/Key saved/).first()).toBeVisible();
  await page.getByLabel("Other names to scrub").fill("Casey Contact");
  await page.getByRole("button", { name: "Save names" }).click();
  await expect(page.getByText("Saved 1 name to scrub.")).toBeVisible();

  await addAssociate(page, "Rae Hybrid", { pm: true, payroll: true }, "Great with REC-style retail clients; ask Casey Contact at rae@example.com.");

  await page.goto("/clients/new");
  await page.getByRole("radio", { name: /^Implementation/ }).check();
  await page.getByLabel("Company code").fill("REC");
  await page.getByLabel("Name (optional)").fill("Recco Retail");
  await page.getByText("Hybrid", { exact: true }).click();
  await page.getByLabel("Implementation type").selectOption("NEW_LOGO");
  await page.getByLabel("Previous vendor").selectOption("NEW");
  await page.getByLabel("Employee count").fill("40");
  await page.getByLabel("Control count").fill("1");
  await page.getByRole("radiogroup", { name: /Payroll complexity/ }).getByText("2", { exact: true }).click();
  await page.getByLabel("First input date").fill(isoInDays(45));
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: /REC/, level: 1 })).toBeVisible();

  // Preview, then ask.
  await page.getByRole("link", { name: "Assign" }).last().click();
  await expect(page.getByRole("heading", { name: "Recommend a team with Claude" })).toBeVisible();
  await page.getByText("Preview what will be sent").click();
  await expect(page.locator("pre")).toContainText("ASSOC_");
  await expect(page.locator("pre")).not.toContainText("Rae Hybrid");
  await page.getByRole("button", { name: "Recommend team" }).click();

  await expect(page.getByText("Recommended team")).toBeVisible({ timeout: 30_000 });
  // Aliases in Claude's answer are mapped back to real names for you.
  await expect(page.getByText("Rae Hybrid has no PTO near go-live and plenty of capacity.")).toBeVisible();
  await expect(page.getByText("Fit 91")).toBeVisible();

  // What actually reached the API: no names, codes, contacts or emails.
  const sent = JSON.stringify(await (await page.request.get(`${MOCK_CLAUDE}/__last`)).json());
  for (const secret of ["Rae Hybrid", "Recco", "REC", "Casey Contact", "rae@example.com"]) {
    expect(sent, secret).not.toContain(secret);
  }
  expect(sent).toContain("[NAME]");
  expect(sent).toContain("[REDACTED_EMAIL]");
  expect(sent).toContain('"fallbacks":"default"');

  await page.getByRole("button", { name: "Accept team" }).click();
  await expect(page.getByRole("heading", { name: /REC/, level: 1 })).toBeVisible();
  await expect(page.getByText("1 of 1 seat filled")).toBeVisible();

  // History and usage.
  await page.getByRole("link", { name: "Review" }).click();
  await page.getByText(/^Recommendation history/).click();
  await expect(page.getByText(/Accepted · claude-opus-5-5/)).toBeVisible();
  await page.goto("/settings?tab=claude");
  await expect(page.getByText("1 accepted, 0 with changes, 0 declined")).toBeVisible();

  // Leave the book clean for later specs.
  await page.goto("/clients");
  await page.getByRole("link", { name: "REC" }).click();
  await page.getByRole("button", { name: "Move to Service" }).click();
  await page.getByRole("dialog", { name: /Move to Service/ }).getByRole("button", { name: "Move to Service" }).click();
  await expect(page.getByText("In Service: the team's assignments have ended.")).toBeVisible();
});
