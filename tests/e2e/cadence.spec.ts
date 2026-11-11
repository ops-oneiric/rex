import { expect, test } from "@playwright/test";
import { isoInDays, signIn } from "./helpers";

// Uses the local Claude stand-in (tests/e2e/mock-claude.mjs) and the API key saved in auth.spec.
test.describe.configure({ mode: "serial" });

test("log 1:1s, get insights, work the action items and see trends", async ({ page }) => {
  await signIn(page, "/associates/new");
  await page.getByLabel("Name").fill("Morgan Mentee");
  await page.getByLabel("Time zone").selectOption("America/Chicago");
  await page.locator('input[name="isDirectlyManaged"]').check();
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByRole("heading", { name: "Morgan Mentee", level: 1 })).toBeVisible();

  // The Cadence page lists directly managed associates.
  await page.goto("/cadence");
  const row = page.getByRole("row", { name: /Morgan Mentee/ });
  await expect(row).toContainText("No 1:1 yet");
  await row.getByRole("link", { name: "Log a 1:1 with Morgan Mentee" }).click();

  // Two inputs: date and notes.
  await expect(page.getByRole("heading", { name: "Log a 1:1" })).toBeVisible();
  await page.getByLabel("Date").first().fill(isoInDays(-7));
  await page.getByLabel("Notes", { exact: true }).fill("Talked through the ACM go-live. Feeling more confident. Agreed she'll share the tax checklist.");
  await page.getByRole("button", { name: "Save 1:1" }).click();
  await expect(page.getByText("Saved. Claude is reading your notes.")).toBeVisible();

  // The analysis arrives in the background.
  await expect(page.getByText("Solid week; go-live prep is on track")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("article").first()).toContainText("Morale: Positive");
  await expect(page.getByText("Multi-state tax setup (Multi-State)")).toBeVisible();

  const openItems = page.getByRole("region", { name: "Open action items" });
  await expect(openItems).toContainText("Share the tax setup checklist");
  await expect(openItems).toContainText("Book a shadowing session on multi-state setup");

  // Tick one off.
  await openItems.getByRole("checkbox", { name: /Mark done: Book a shadowing session/ }).check();
  await expect(openItems.getByText("Book a shadowing session on multi-state setup")).toHaveCount(0);
  await expect(openItems).toContainText("1 done or dropped.");

  // A second 1:1: Claude spots progress on an earlier open item and offers to close it.
  await page.getByLabel("Date").first().fill(isoInDays(-1));
  await page.getByLabel("Notes", { exact: true }).fill("Checklist shared on Monday. Next: shadowing on multi-state.");
  await page.getByRole("button", { name: "Save 1:1" }).click();
  await expect(page.getByText("Earlier action items")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/looks done: Mentioned it was finished/)).toBeVisible();
  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(openItems).toContainText("2 done or dropped.");

  // Add an item by hand.
  await page.getByLabel("New action item").fill("Review PTO plans for December");
  await page.getByRole("button", { name: "Add action item" }).click();
  await expect(openItems).toContainText("Review PTO plans for December");

  // Trends across the 1:1s.
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByText("Talking points for the next 1:1")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Agree when to escalate a blocker")).toBeVisible();
  await expect(page.getByText("Morale improving")).toBeVisible();

  // The Cadence page reflects the rhythm and your own open items.
  await page.goto("/cadence");
  await expect(page.getByRole("row", { name: /Morgan Mentee/ })).toContainText("On track");
  await expect(page.getByText("Review PTO plans for December")).toBeVisible();

  // Deleting a 1:1 removes it and its items.
  await page.goto("/cadence");
  await page.getByRole("link", { name: "Morgan Mentee", exact: true }).click();
  const entries = page.getByRole("article");
  await expect(entries).toHaveCount(2);
  await entries.first().getByRole("button", { name: "Delete this 1:1" }).click();
  await page.getByRole("dialog", { name: "Delete this 1:1?" }).getByRole("button", { name: "Delete" }).click();
  await expect(entries).toHaveCount(1);
});

test("1:1 rhythm can be changed in Settings", async ({ page }) => {
  await signIn(page, "/settings");
  await page.getByLabel("1:1 every (days)").fill("7");
  await page.getByRole("button", { name: "Save rhythm" }).click();
  await expect(page.getByText("1:1 rhythm saved.")).toBeVisible();
  await page.getByLabel("1:1 every (days)").fill("14");
  await page.getByRole("button", { name: "Save rhythm" }).click();
  await expect(page.getByText("1:1 rhythm saved.")).toBeVisible();
});
