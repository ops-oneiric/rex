import { expect, type Page, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

// Runs after associates.spec and clients.spec (alphabetical), on the same database.
test.describe.configure({ mode: "serial" });

async function addAssociate(page: Page, name: string, seats: { pm: boolean; payroll: boolean }) {
  await page.goto("/associates/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.locator('input[name="canPm"]').setChecked(seats.pm);
  await page.locator('input[name="canPayroll"]').setChecked(seats.payroll);
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("assign a team with rules, override a PTO knock-out, and end it at Service", async ({ page }) => {
  await signIn(page, "/associates");
  const firstInput = isoInDays(30);

  await addAssociate(page, "Pat Payroll", { pm: false, payroll: true });
  await page.getByRole("navigation", { name: "Associate sections" }).getByRole("link", { name: /PTO/ }).click();
  await page.getByLabel("First day").fill(isoInDays(29));
  await page.getByLabel("Last day").fill(isoInDays(29));
  await page.getByRole("button", { name: "Add PTO" }).click();
  await expect(page.getByText(/PTO added/)).toBeVisible();
  await addAssociate(page, "Quinn Hybrid", { pm: true, payroll: true });
  await addAssociate(page, "Riley PM", { pm: true, payroll: false });

  // A Traditional implementation client.
  await page.goto("/clients/new?stage=IMPLEMENTATION");
  await page.getByRole("radio", { name: /^Implementation/ }).check();
  await page.getByLabel("Company code").fill("TMS");
  await page.getByText("Traditional", { exact: true }).click();
  await page.getByLabel("Implementation type").selectOption("NEW_LOGO");
  await page.getByLabel("Previous vendor").selectOption("NEW");
  await page.getByLabel("Employee count").fill("80");
  await page.getByLabel("Control count").fill("1");
  await page.getByRole("radiogroup", { name: /Payroll complexity/ }).getByText("2", { exact: true }).click();
  await page.getByLabel("First input date").fill(firstInput);
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: "TMS", level: 1 })).toBeVisible();
  await expect(page.getByText("0 of 2 seats filled")).toBeVisible();

  // The queue lists it; open the PM seat.
  await page.goto("/assign");
  await page.getByRole("link", { name: "Assign team for TMS" }).click();
  await expect(page.getByRole("heading", { name: /Ranked candidates for PM/ })).toBeVisible();
  const ranked = page.getByRole("list").filter({ has: page.getByRole("listitem", { name: "Riley PM" }) }).first();
  await expect(ranked.getByRole("listitem", { name: "Quinn Hybrid" })).toBeVisible();
  await page.getByText(/^Not eligible \(\d+\)$/).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Pat Payroll" })).toContainText("Not eligible for PM seats");
  await page.getByRole("button", { name: "Assign Riley PM" }).click();

  // Moves on to the payroll seat: Pat is knocked out by PTO.
  await expect(page.getByRole("heading", { name: /Ranked candidates for Payroll/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Knocked out by PTO/ })).toBeVisible();
  await expect(page.getByText(/^PTO near first input: /)).toBeVisible();
  await page.getByRole("button", { name: "Assign Pat Payroll anyway" }).click();
  const dialog = page.getByRole("dialog", { name: /Assign Pat Payroll despite PTO/ });
  await dialog.getByRole("button", { name: "Assign anyway" }).click();
  await expect(dialog.getByText("Give a short reason")).toBeVisible();
  await dialog.getByLabel("Reason").fill("PTO is moving to the week after");
  await dialog.getByRole("button", { name: "Assign anyway" }).click();

  // Back on the client: full team with the override on record.
  await expect(page.getByRole("heading", { name: "TMS", level: 1 })).toBeVisible();
  await expect(page.getByText("2 of 2 seats filled")).toBeVisible();
  await expect(page.getByText(/PTO override: PTO is moving/)).toBeVisible();

  // Clients table and roster show the team and loads.
  await page.goto("/clients");
  await expect(page.getByRole("row", { name: /TMS/ })).toContainText("Riley PM");
  await page.goto("/associates");
  await expect(page.getByRole("row", { name: /Pat Payroll/ })).toContainText("1 account");

  // An associate with assignments cannot be deleted.
  await page.getByRole("link", { name: "Pat Payroll" }).click();
  await expect(page.getByRole("heading", { name: "Pat Payroll", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Associate sections" }).getByRole("link", { name: /Clients/ }).click();
  await expect(page.getByRole("link", { name: "TMS" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete associate" }).click();
  await expect(page.getByRole("dialog").getByText(/Deactivate them instead/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  // Dashboard: nothing awaiting assignment, capacity lists the team.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Awaiting assignment/ })).toContainText("0");
  await expect(page.locator(".glass", { has: page.getByRole("heading", { name: "Capacity", exact: true }) }).getByRole("link", { name: "Pat Payroll" })).toBeVisible();

  // Unassigning on the same day removes the seat holder.
  await page.goto("/clients");
  await page.getByRole("link", { name: "TMS" }).click();
  await page.getByRole("button", { name: "Unassign Pat Payroll" }).click();
  await page.getByRole("dialog", { name: /Unassign Pat Payroll/ }).getByRole("button", { name: "Unassign" }).click();
  await expect(page.getByText("1 of 2 seats filled")).toBeVisible();

  // Moving to Service ends the team, keeping history.
  await page.getByRole("button", { name: "Move to Service" }).click();
  await page.getByRole("dialog", { name: /Move to Service/ }).getByRole("button", { name: "Move to Service" }).click();
  await expect(page.getByText("In Service: the team's assignments have ended.")).toBeVisible();
  await page.getByText(/Past team members/).click();
  await expect(page.getByText("Moved to Service")).toBeVisible();
});

test("assignment rules can be changed in Settings", async ({ page }) => {
  await signIn(page, "/settings?tab=rules");
  await page.getByRole("spinbutton", { name: "Days before" }).fill("10");
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByText("Assignment rules saved.")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Healthy from" }).fill("9");
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByText(/Load bands must go up/)).toBeVisible();
  await page.getByRole("button", { name: "Reset rules" }).click();
  await expect(page.getByText("Assignment rules reset to the defaults.")).toBeVisible();
});
