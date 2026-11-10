"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ADMIN_ID, getAdmin } from "@/lib/auth/admin";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import {
  formatDuration,
  lockoutDurationMs,
  RateLimiter,
  safeRedirectPath,
} from "@/lib/auth/policy";
import { createSession, destroySession } from "@/lib/auth/session";
import { clientIp, userAgent } from "@/lib/request";

export type LoginState = { error?: string; username?: string };

const GENERIC_ERROR = "Incorrect username or password.";
// At most 10 attempts per IP address every 15 minutes, on top of the account lockout.
const ipLimiter = new RateLimiter(10, 15 * 60 * 1000);

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next"));
  const ip = await clientIp();

  if (!username || !password) {
    return { error: "Enter your username and password.", username };
  }

  if (!ipLimiter.attempt(ip ?? "unknown")) {
    audit("login.rate_limited", null, ip);
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again.", username };
  }

  const admin = getAdmin();
  if (!admin) {
    await burnPasswordCheck(password);
    return {
      error: "No admin account exists yet. Create one on the server (see README: Create the admin account).",
      username,
    };
  }

  const now = Date.now();
  if (admin.lockedUntil && admin.lockedUntil.getTime() > now) {
    audit("login.locked", null, ip);
    return {
      error: `Sign-in is locked after repeated failures. Try again in ${formatDuration(admin.lockedUntil.getTime() - now)}.`,
      username,
    };
  }

  const usernameMatches = username.toLowerCase() === admin.username.toLowerCase();
  const passwordMatches = usernameMatches
    ? await verifyPassword(admin.passwordHash, password)
    : (await burnPasswordCheck(password), false);

  if (!passwordMatches) {
    const failedAttempts = admin.failedAttempts + 1;
    const lockMs = lockoutDurationMs(failedAttempts);
    db.update(schema.adminUser)
      .set({ failedAttempts, lockedUntil: lockMs ? new Date(now + lockMs) : null, updatedAt: new Date() })
      .where(eq(schema.adminUser.id, ADMIN_ID))
      .run();
    audit("login.failure", { failedAttempts }, ip);
    if (lockMs) {
      return {
        error: `Too many failed attempts. Sign-in is locked for ${formatDuration(lockMs)}.`,
        username,
      };
    }
    return { error: GENERIC_ERROR, username };
  }

  db.update(schema.adminUser)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(schema.adminUser.id, ADMIN_ID))
    .run();
  await createSession({ ip, userAgent: await userAgent() });
  audit("login.success", null, ip);
  redirect(next);
}

export async function logout() {
  await destroySession();
  audit("logout", null, await clientIp());
  redirect("/login");
}
