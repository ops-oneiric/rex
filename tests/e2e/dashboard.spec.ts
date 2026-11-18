import { expect, type Page, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

// Shares the e2e database with the other specs, so it removes what it adds.
test.describe.configure({ mode: "serial" });

function card(page: Page, title: string) {
  return page.locator(".glass", { has: page.getByRole("heading", { name: title, exact: true }) });
}

const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Moves the dashboard calendar to the day and selects it. */
async function openCalendarDay(page: Page, iso: string) {
  const at = new Date(`${iso}T00:00:00Z`);
  const cal = card(page, "Calendar");
  for (let i = 0; i < 6 && !(await cal.getByRole("heading", { name: monthLabel.format(at) }).isVisible()); i++) {
    await cal.getByRole("button", { name: "Next month" }).click();
  }
  await cal.getByRole("button", { name: new RegExp(`^${dayLabel.format(at)}`) }).click();
  return cal.getByRole("region", { name: "Selected day" });
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

  // Calendar: the first input and the time off, with filters.
  let day = await openCalendarDay(page, isoInDays(12));
  await expect(day.getByRole("link", { name: "DSH · Dashwood Partners" })).toBeVisible();
  await expect(day).toContainText("Fast start");
  await expect(day).toContainText("No team yet");
  await card(page, "Calendar").getByRole("button", { name: "First inputs", exact: true }).click();
  await expect(day.getByRole("link", { name: "DSH · Dashwood Partners" })).toHaveCount(0);
  await card(page, "Calendar").getByRole("button", { name: "First inputs", exact: true }).click();
  await card(page, "Calendar").getByRole("button", { name: "Go to today" }).click();
  day = await openCalendarDay(page, isoInDays(10));
  await expect(day.getByRole("link", { name: "Dana Dashboard" })).toBeVisible();
  await card(page, "Calendar").getByLabel("Show one associate").selectOption({ label: "Dana Dashboard" });
  await expect(day.getByRole("link", { name: "Dana Dashboard" })).toBeVisible();
  // Arrow keys move the selection: two days later is the first input.
  await openCalendarDay(page, isoInDays(10));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  // DSH has no team, so filtering to Dana hides it.
  await expect(day).toContainText("Nothing scheduled.");
  await card(page, "Calendar").getByLabel("Show one associate").selectOption("all");
  await expect(day.getByRole("link", { name: "DSH · Dashwood Partners" })).toBeVisible();

  // Command palette: by company code, by name, to a page; and from the sidebar button.
  await openPalette(page);
  await page.getByRole("combobox", { name: "Jump to a client, associate or page" }).fill("dsh");
  await expect(page.getByRole("option", { name: /DSH · Dashwood Partners/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /DSH/, level: 1 })).toBeVisible();

  await openPalette(page);
  await page.getByRole("combobox", { name: "Jump to a client, associate or page" }).fill("dana dash");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Dana Dashboard", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("combobox", { name: "Jump to a client, associate or page" }).fill("insi");
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
