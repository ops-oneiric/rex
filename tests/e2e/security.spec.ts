import fs from "node:fs";
import { expect, request, test } from "@playwright/test";
import { signIn } from "./helpers";

test("pages carry a nonce-based content security policy and still work", async ({ page }) => {
  const response = await page.goto("/login");
  const csp = response!.headers()["content-security-policy"]!;
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
  // Each request gets its own nonce.
  const again = (await page.goto("/login"))!.headers()["content-security-policy"];
  expect(again).not.toBe(csp);
  // Hydration works under the policy: the sign-in form submits through a server action.
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy/.test(m.text()) && violations.push(m.text()));
  await signIn(page, "/settings?tab=security");
  await expect(page.getByRole("heading", { name: "Sign-in activity" })).toBeVisible();
  expect(violations).toEqual([]);
});

test("security tab shows sessions and sign-in activity", async ({ page }) => {
  await signIn(page, "/settings?tab=security");
  await expect(page.getByText("This browser")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Signed in", exact: true }).first()).toBeVisible();
});

test("back up now, download the encrypted file, and export CSV", async ({ page }) => {
  await signIn(page, "/settings?tab=backups");
  await page.getByRole("button", { name: "Back up now" }).click();
  await expect(page.getByText(/^Backup rex-\d{8}-\d{6}\.rexbak saved\.$/)).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /^Download backup from / }).first().click()]);
  expect(download.suggestedFilename()).toMatch(/^rex-\d{8}-\d{6}\.rexbak$/);
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.subarray(0, 8).toString("ascii")).toBe("REXBAK01");
  expect(bytes.includes(Buffer.from("SQLite format 3"))).toBe(false);

  const csv = await page.request.get("/api/export/clients");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["cache-control"]).toBe("no-store");
  expect((await csv.text()).replace(/^﻿/, "")).toMatch(/^Company code,Name,Stage,/);
  expect((await page.request.get("/api/export/nope")).status()).toBe(404);
  expect((await page.request.get("/api/backups/..%2F..%2Fe2e.db")).status()).toBe(404);
});

test("downloads need a real session", async ({ baseURL }) => {
  const anonymous = await request.newContext({ baseURL });
  const redirected = await anonymous.get("/api/export/clients", { maxRedirects: 0 });
  expect(redirected.status()).toBe(307);
  expect(redirected.headers()["location"]).toContain("/login");
  const forged = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: "rex_session=not-a-real-session" } });
  expect((await forged.get("/api/export/clients")).status()).toBe(404);
  expect((await forged.get("/api/backups/rex-20260101-000000.rexbak")).status()).toBe(404);
  await anonymous.dispose();
  await forged.dispose();
});
