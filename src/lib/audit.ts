import "server-only";
import { db, schema } from "@/lib/db";

export type AuditAction =
  | "login.success"
  | "login.failure"
  | "login.locked"
  | "login.rate_limited"
  | "logout"
  | "password.changed"
  | "ai.key_saved"
  | "ai.key_removed"
  | "ai.model_changed"
  | "settings.time_zone_changed"
  | "associate.created"
  | "associate.updated"
  | "associate.activated"
  | "associate.deactivated"
  | "associate.deleted"
  | "associate.capabilities_saved"
  | "pto.added"
  | "pto.deleted"
  | "capability.created"
  | "capability.updated"
  | "capability.deleted";

export function audit(action: AuditAction, detail: Record<string, unknown> | null = null, ip: string | null = null) {
  db.insert(schema.auditLog).values({ action, detail, ip }).run();
}
