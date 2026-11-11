import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./helpers";

// Clicking anywhere on a table row opens that row, not another one. The rows used to rely
// on a stretched-link overlay that escaped the row in some browsers, so every click opened
// the last row. Also covers company codes with hyphens.
test.describe.configure({ mode: "serial" });

async function addAssociate(page: Page, name: string, timeZone: string) {
  await page.goto("/associates/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Time zone").selectOption(timeZone);
  await page.getByRole("button", { name: "Add associate" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

async function addProspect(page: Page, code: string, name: string) {
  await page.goto("/clients/new");
  await page.getByLabel("Company code").fill(code);
  await page.getByLabel("Name (optional)").fill(name);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(code, "i"), level: 1 })).toBeVisible();
}

test("rows open the clicked associate or client; hyphenated codes work", async ({ page }) => {
  await signIn(page, "/associates");
  await addAssociate(page, "Aaron Rowfirst", "America/New_York");
  await addAssociate(page, "Zelda Rowlast", "America/Los_Angeles");

  // Click a plain cell (time zone) of the first of the two, away from the name link.
  await page.goto("/associates");
  await page.getByLabel("Search associates").fill("Row");
  const rows = page.getByRole("row").filter({ hasText: /Rowfirst|Rowlast/ });
  await expect(rows).toHaveCount(2);
  await rows.filter({ hasText: "Aaron Rowfirst" }).getByRole("cell").nth(2).click();
  await expect(page.getByRole("heading", { name: "Aaron Rowfirst", level: 1 })).toBeVisible();
  await page.goBack();
  await page.getByLabel("Search associates").fill("Row");
  await rows.filter({ hasText: "Zelda Rowlast" }).getByRole("cell").nth(4).click();
  await expect(page.getByRole("heading", { name: "Zelda Rowlast", level: 1 })).toBeVisible();

  // A hyphenated company code: typed in lower case, stored upper case.
  await addProspect(page, "r-1", "Rowan Hyphen Co");
  await expect(page.getByRole("heading", { name: /R-1/, level: 1 })).toBeVisible();
  await addProspect(page, "R-2", "Rowan Second Co");
  // "---" has no letter or digit.
  await page.goto("/clients/new");
  await page.getByLabel("Company code").fill("---");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByText("Company codes are exactly 3 characters: letters, digits or hyphens.")).toBeVisible();

  await page.goto("/clients");
  await page.getByLabel("Filter by stage").selectOption("all");
  await page.getByLabel("Search clients").fill("Rowan");
  const clientRows = page.getByRole("row").filter({ hasText: "Rowan" });
  await expect(clientRows).toHaveCount(2);
  await clientRows.filter({ hasText: "R-1" }).getByRole("cell").nth(1).click();
  await expect(page.getByRole("heading", { name: /R-1/, level: 1 })).toBeVisible();

  // Palette finds the hyphenated code exactly.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("r-2");
  await expect(page.getByRole("option", { name: /R-2 · Rowan Second Co/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");

  // Clean up.
  for (const code of ["R-1", "R-2"]) {
    await page.goto("/clients");
    await page.getByLabel("Filter by stage").selectOption("all");
    await page.getByRole("link", { name: code, exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete client" }).click();
    await expect(page).toHaveURL(/\/clients$/);
  }
  for (const name of ["Aaron Rowfirst", "Zelda Rowlast"]) {
    await page.goto("/associates");
    await page.getByRole("link", { name }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete associate" }).click();
    await expect(page).toHaveURL(/\/associates$/);
  }
});
