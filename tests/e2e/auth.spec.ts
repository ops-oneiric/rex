import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "../../playwright.config";

test.describe.configure({ mode: "serial" });

test("unauthenticated visitors are sent to the login page", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect" })).toContainText(
    "Incorrect username or password",
  );
});

test("admin can sign in, navigate, and sign out", async ({ page }) => {
  await page.goto("/login?next=/settings?tab=claude");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/settings\?tab=claude$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByText("No key saved")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Associates" }).click();
  await expect(page.getByRole("heading", { name: "Associates", level: 1 })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Associates" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("API key is stored and shown only by its last four characters", async ({ page }) => {
  await page.goto("/login?next=/settings?tab=claude");
  await page.getByLabel("Username").fill(E2E_ADMIN.username);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=claude$/);

  // A fake key: the connection test will fail, but the key must still be saved encrypted.
  await page.getByLabel("API key").fill("sk-ant-e2e-fake-key-000000000000wxyz");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("Key saved", { exact: true })).toBeVisible();
  await expect(page.getByText("ending in wxyz")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("sk-ant-e2e-fake-key");
});
