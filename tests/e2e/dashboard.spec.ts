import { expect, type Page, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

// Shares the e2e database with the other specs, so it removes what it adds.
test.describe.configure({ mode: "serial" });

function card(page: Page, title: string) {
  return page.locator(".glass", { has: page.getByRole("heading", { name: title, exact: true }) });
}

async function openPalette(page: Page) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search Rex" })).toBeVisible();
}

test("dashboard widgets, command palette and insights", async ({ page }) => {
  await signIn(page, "/associates/new");
  await page.getByLabel("Name").fill("Dana Dashboard");
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.locator('input[name="canPm"]').setChecked(true);
  await page.locator('input[name="canPayroll"]').setChecked(true);
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByRole("heading", { name: "Dana Dashboard", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Associate sections" }).getByRole("link", { name: /PTO/ }).click();
  await page.getByLabel("First day").fill(isoInDays(9));
  await page.getByLabel("Last day").fill(isoInDays(10));
  await page.getByRole("button", { name: "Add PTO" }).click();
  await expect(page.getByText(/PTO added/)).toBeVisible();

  // A fast start: first input in 12 days with no team.
  await page.goto("/clients/new?stage=IMPLEMENTATION");
  await page.getByRole("radio", { name: /^Implementation/ }).check();
  await page.getByLabel("Company code").fill("DSH");
  await page.getByLabel("Name (optional)").fill("Dashwood Partners");
  await page.getByText("Hybrid", { exact: true }).click();
  await page.getByLabel("Implementation type").selectOption("ADD_CONTROL");
  await page.getByLabel("Previous vendor").selectOption("IN_HOUSE");
  await page.getByLabel("Employee count").fill("40");
  await page.getByLabel("Control count").fill("1");
  await page.getByRole("radiogroup", { name: /Payroll complexity/ }).getByText("2", { exact: true }).click();
  await page.getByLabel("First input date").fill(isoInDays(12));
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: /DSH/, level: 1 })).toBeVisible();

  // Dashboard.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Awaiting assignment/ })).toContainText(/\d+ fast starts?/);
  await expect(card(page, "Awaiting assignment").getByRole("listitem").filter({ hasText: "DSH · Dashwood Partners" })).toContainText("Fast start");
  await expect(page.getByRole("region", { name: "Needs attention" })).toContainText(/fast starts? still needs? a team/);
  await expect(card(page, "Upcoming PTO")).toContainText("Dana Dashboard");
  await expect(card(page, "Capacity").getByRole("link", { name: "Dana Dashboard" })).toBeVisible();

  // Command palette: by company code, by name, to a page; and from the sidebar button.
  await openPalette(page);
  await page.getByRole("combobox").fill("dsh");
  await expect(page.getByRole("option", { name: /DSH · Dashwood Partners/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /DSH/, level: 1 })).toBeVisible();

  await openPalette(page);
  await page.getByRole("combobox").fill("dana dash");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Dana Dashboard", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("combobox").fill("insi");
  await page.getByRole("option", { name: /Insights/ }).click();
  await expect(page).toHaveURL(/\/insights$/);
  await openPalette(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search Rex" })).toBeHidden();

  // Insights: every section renders and the period switch works.
  for (const title of ["Team load by week", "First inputs per week, next 26 weeks", "Assignment to first input", "Implementation duration", "Fast start vs. normal start", "Recommendation outcomes"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(card(page, "Clients by stage").getByRole("listitem", { name: /^Implementation: \d+/ })).toBeVisible();
  await page.getByRole("link", { name: "12 months" }).click();
  await expect(page.getByRole("link", { name: "12 months" })).toHaveAttribute("aria-current", "page");
  await page.getByText("Show as table").first().click();
  await expect(page.getByRole("cell", { name: /^Today, / })).toBeVisible();

  // Clean up so later specs see the database they expect.
  await page.goto("/clients");
  await page.getByLabel("Filter by stage").selectOption("all");
  await page.getByRole("link", { name: "DSH", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete client" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.goto("/associates");
  await page.getByRole("link", { name: "Dana Dashboard" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete associate" }).click();
  await expect(page).toHaveURL(/\/associates$/);
});
