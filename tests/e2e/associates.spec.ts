import { expect, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("add an associate, set capabilities and PTO, then edit, deactivate and delete", async ({ page }) => {
  await signIn(page, "/associates");
  await expect(page.getByRole("heading", { name: "No associates yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add associate" }).click();

  // Validation: no name, no seats.
  await page.getByLabel("Payroll", { exact: false }).first().uncheck();
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByText("Enter the associate's name.")).toBeVisible();
  await expect(page.getByText("Choose at least one seat")).toBeVisible();

  await page.getByLabel("Name").fill("Jordan Lee");
  await page.getByLabel("Title").fill("Implementation Specialist");
  await page.getByLabel("Time zone").selectOption("America/New_York");
  await page.locator('input[name="canPm"]').check();
  await page.locator('input[name="canPayroll"]').check();
  await page.getByLabel("Target load").fill("7.5");
  await page.locator('input[name="isDirectlyManaged"]').check();
  await page.getByRole("button", { name: "Add associate" }).click();

  // Lands on the capabilities tab.
  await expect(page.getByRole("heading", { name: "Jordan Lee", level: 1 })).toBeVisible();
  await expect(page.getByText("Jordan Lee was added.")).toBeVisible();
  await expect(page.getByText("Hybrid-eligible")).toBeVisible();

  const multiControl = page.getByRole("radiogroup", { name: "Multi-Control" });
  await multiControl.getByText("Expert").click();
  await page.getByRole("radiogroup", { name: "Garnishments" }).getByText("Learning").click();
  await page.getByLabel("Capability notes").fill("Strong with restaurant clients.");
  await page.getByRole("button", { name: "Save capabilities" }).click();
  await expect(page.getByText("Capabilities saved.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Capabilities/ })).toContainText("2");

  // PTO: add, reject an overlap, remove.
  await page.getByRole("link", { name: /^PTO/ }).click();
  await expect(page.getByText("No PTO scheduled")).toBeVisible();
  const start = isoInDays(30);
  const end = isoInDays(34);
  await page.getByLabel("First day").fill(start);
  await page.getByLabel("Last day").fill(end);
  await page.getByLabel("Note (optional)").fill("Vacation");
  await page.getByRole("button", { name: "Add PTO" }).click();
  await expect(page.getByText(/PTO added/)).toBeVisible();
  await expect(page.getByText("Vacation")).toBeVisible();

  await page.getByLabel("First day").fill(isoInDays(32));
  await page.getByLabel("Last day").fill(isoInDays(40));
  await page.getByRole("button", { name: "Add PTO" }).click();
  await expect(page.getByText(/This overlaps existing PTO/)).toBeVisible();

  // Roster shows the associate with chips and next PTO.
  await page.getByRole("link", { name: "All associates" }).click();
  const row = page.getByRole("row", { name: /Jordan Lee/ });
  await expect(row).toContainText("Multi-Control");
  await expect(row).toContainText("Eastern");
  await expect(row).toContainText("Managed");
  await page.getByLabel("Search associates").fill("garnish");
  await expect(row).toBeVisible();
  await page.getByLabel("Search associates").fill("nobody");
  await expect(page.getByText("No associates match these filters.")).toBeVisible();
  await page.getByLabel("Search associates").fill("");

  // A second associate with the same name is rejected.
  await page.getByRole("link", { name: "Add associate" }).click();
  await page.getByLabel("Name").fill("jordan lee");
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByText(/already exists/)).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("jordan lee");

  // Edit.
  await page.goto("/associates");
  await page.getByRole("link", { name: "Jordan Lee" }).click();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Name").fill("Jordan A. Lee");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Jordan A. Lee", level: 1 })).toBeVisible();
  await expect(page.getByText("7.5 weighted units")).toBeVisible();

  // Remove the PTO entry.
  await page.getByRole("link", { name: /^PTO/ }).click();
  await page.getByRole("button", { name: /Remove PTO/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No PTO scheduled")).toBeVisible();

  // Deactivate hides them from the default roster view.
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Inactive: excluded from recommendations")).toBeVisible();
  await page.goto("/associates");
  await expect(page.getByRole("row", { name: /Jordan A. Lee/ })).toHaveCount(0);
  await page.getByLabel("Filter by status").selectOption("inactive");
  await expect(page.getByRole("row", { name: /Jordan A. Lee/ })).toBeVisible();

  // Delete.
  await page.getByRole("link", { name: "Jordan A. Lee" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete associate" }).click();
  await expect(page).toHaveURL(/\/associates$/);
  await expect(page.getByRole("heading", { name: "No associates yet" })).toBeVisible();
});

test("manage the capability list in Settings", async ({ page }) => {
  await signIn(page, "/settings?tab=capabilities");
  const section = page.locator("#capabilities");
  await expect(section.getByText("Multi-Control", { exact: true })).toBeVisible();

  await section.getByLabel("New capability").fill("Payroll Tax");
  await section.getByLabel("Description").fill("Tax registrations and filings.");
  await section.getByRole("button", { name: "Add capability" }).click();
  await expect(section.getByText('Added "Payroll Tax".')).toBeVisible();

  await section.getByRole("button", { name: "Edit Payroll Tax" }).click();
  await section.getByLabel("Capability name").fill("Payroll Tax Setup");
  await section.getByRole("button", { name: "Save capability" }).click();
  await expect(section.getByText("Payroll Tax Setup", { exact: true })).toBeVisible();

  await section.getByRole("button", { name: "Delete Payroll Tax Setup" }).click();
  await page.getByRole("dialog", { name: /Delete "Payroll Tax Setup"/ }).getByRole("button", { name: "Delete capability" }).click();
  await expect(section.getByText("Payroll Tax Setup", { exact: true })).toHaveCount(0);
});

test("home time zone can be changed", async ({ page }) => {
  await signIn(page, "/settings");
  await page.getByLabel("Your time zone").selectOption("America/Denver");
  await page.getByRole("button", { name: "Save time zone" }).click();
  await expect(page.getByText("Time zone saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your time zone")).toHaveValue("America/Denver");
});
