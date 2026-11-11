import { expect, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("prospect to implementation to service, with validation, history and views", async ({ page }) => {
  await signIn(page, "/clients");
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add client" }).click();

  // A prospect needs only a code or a name.
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByText("Enter a company code or a name")).toBeVisible();
  await page.getByLabel("Name (optional)").fill("Acme Manufacturing");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: "Acme Manufacturing", level: 1 })).toBeVisible();
  await expect(page.getByText(/was added as a prospect/)).toBeVisible();
  await expect(page.getByText(/Before this prospect can move to Implementation, fill in: Company code/)).toBeVisible();

  // Moving on too early explains what is missing.
  await page.getByRole("button", { name: "Move to Implementation" }).click();
  const dialog = page.getByRole("dialog", { name: /Move to Implementation/ });
  await dialog.getByRole("button", { name: "Move to Implementation" }).click();
  await expect(dialog.getByText(/Fill in these fields first: Company code/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Fill in every field.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Company code").fill("acm");
  await page.getByText("Traditional", { exact: true }).click();
  await page.getByLabel("Implementation type").selectOption("NEW_LOGO");
  await page.getByLabel("Previous vendor").selectOption("IN_HOUSE");
  await page.getByLabel("Employee count").fill("120");
  await page.getByLabel("Control count").fill("1");
  await page.getByRole("radiogroup", { name: /Payroll complexity/ }).getByText("3", { exact: true }).click();
  await page.getByLabel("First input date").fill(isoInDays(14));
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  // Live preview: 0.5 base + 0.2 employees + 0.2 complexity + 0.2 New Logo + 0.2 fast start.
  await expect(page.getByText("Fast start if assigned today")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Workload weight preview" })).toContainText("1.30");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: /ACM/, level: 1 })).toBeVisible();
  await expect(page.getByText("Fast start", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Before this prospect can move/)).toHaveCount(0);

  // Prospect -> Implementation with a note.
  await page.getByRole("button", { name: "Move to Implementation" }).click();
  const move = page.getByRole("dialog", { name: /Move to Implementation/ });
  await move.getByLabel("Note (optional)").fill("Contract signed");
  await move.getByRole("button", { name: "Move to Implementation" }).click();
  await expect(page.getByText("Prospect to Implementation")).toBeVisible();
  await expect(page.getByText("Contract signed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to Service" })).toBeVisible();

  // Company codes are unique.
  await page.goto("/clients/new");
  await page.getByLabel("Company code").fill("ACM");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByText("Another client already uses this company code.")).toBeVisible();

  // Table and board.
  await page.goto("/clients");
  const row = page.getByRole("row", { name: /ACM/ });
  await expect(row).toContainText("Implementation");
  await expect(row).toContainText("1.30");
  await page.getByLabel("Search clients").fill("zzz");
  await expect(page.getByText("No clients match these filters.")).toBeVisible();
  await page.getByLabel("Search clients").fill("acme");
  await expect(row).toBeVisible();
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page.getByRole("region", { name: "Implementation" })).toContainText("ACM");

  // Implementation -> Service drops it from the default table view.
  await page.getByRole("region", { name: "Implementation" }).getByRole("link", { name: /ACM/ }).click();
  await page.getByRole("button", { name: "Move to Service" }).click();
  await page.getByRole("dialog", { name: /Move to Service/ }).getByRole("button", { name: "Move to Service" }).click();
  await expect(page.getByText("Implementation to Service")).toBeVisible();
  await expect(page.getByText("In service: not counted toward capacity.")).toBeVisible();
  await page.goto("/clients");
  await expect(page.getByRole("row", { name: /ACM/ })).toHaveCount(0);
  await page.getByLabel("Filter by stage").selectOption("SERVICE");
  await expect(page.getByRole("row", { name: /ACM/ })).toBeVisible();
});

test("weights, complexity scale and holidays in Settings", async ({ page }) => {
  await signIn(page, "/settings?tab=rules");
  await expect(page.getByText(/normal start = 1.10/)).toBeVisible();

  // Raising the base weight changes every client's weight.
  await page.getByRole("spinbutton", { name: "Every client" }).fill("1");
  await expect(page.getByText(/normal start = 1.60/)).toBeVisible();
  await page.getByRole("button", { name: "Save weights" }).click();
  await expect(page.getByText(/Weights saved/)).toBeVisible();
  await page.goto("/clients");
  await page.getByLabel("Filter by stage").selectOption("all");
  await expect(page.getByRole("row", { name: /ACM/ })).toContainText("1.60");

  await page.goto("/settings?tab=rules");
  await page.getByRole("button", { name: "Reset weights" }).click();
  await expect(page.getByText("Weights reset to the defaults.")).toBeVisible();
  await expect(page.getByText(/normal start = 1.10/)).toBeVisible();

  // Complexity scale.
  await page.getByLabel("Level 1 description").fill("Very simple payroll.");
  await page.getByRole("button", { name: "Save scale" }).click();
  await expect(page.getByText("Complexity scale saved.")).toBeVisible();

  // Holidays: federal set for a new year, a custom day, and removal.
  await page.getByLabel("Year", { exact: true }).selectOption(String(new Date().getUTCFullYear() + 1));
  await page.getByLabel("Holiday name").fill("Company retreat");
  await page.getByLabel("Date", { exact: true }).fill(`${new Date().getUTCFullYear() + 1}-08-14`);
  await page.getByRole("button", { name: "Add holiday" }).click();
  await expect(page.getByText("Added Company retreat.")).toBeVisible();
  await expect(page.getByText("Company retreat", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Remove Company retreat/ }).click();
  await expect(page.getByText("Company retreat", { exact: true })).toHaveCount(0);

  await page.getByLabel("Year", { exact: true }).selectOption(String(new Date().getUTCFullYear() + 1));
  await page.getByRole("button", { name: /Add US federal holidays/ }).click();
  await expect(page.getByText(/already listed|Added \d+ US federal/)).toBeVisible();
});
