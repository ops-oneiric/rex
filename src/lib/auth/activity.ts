import "server-only";
import { and, desc, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const SIGN_IN_ACTIONS = ["login.success", "login.failure", "login.locked", "login.rate_limited", "logout", "password.changed", "sessions.revoked"];

export const ACTIVITY_LABELS: Record<string, string> = {
  "login.success": "Signed in",
  "login.failure": "Wrong username or password",
  "login.locked": "Blocked: account locked",
  "login.rate_limited": "Blocked: too many attempts from this address",
  logout: "Signed out",
  "password.changed": "Password changed",
  "sessions.revoked": "Other sessions signed out",
};

/** Recent sign-in events from the audit log. */
export function recentSignInActivity(limit = 25) {
  return db
    .select()
    .from(schema.auditLog)
    .where(inArray(schema.auditLog.action, SIGN_IN_ACTIONS))
    .orderBy(desc(schema.auditLog.at), desc(schema.auditLog.id))
    .limit(limit)
    .all();
}

/** Failed or blocked sign-in attempts in the last `hours`. */
export function failedSignIns(hours = 24): number {
  return db
    .select({ id: schema.auditLog.id })
    .from(schema.auditLog)
    .where(
      and(
        inArray(schema.auditLog.action, ["login.failure", "login.locked", "login.rate_limited"]),
        gte(schema.auditLog.at, new Date(Date.now() - hours * 3_600_000)),
      ),
    )
    .all().length;
}
