import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
};

/** The single admin account. Rex only ever has one row here (id = 1). */
export const adminUser = sqliteTable("admin_user", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

/**
 * Login sessions. The browser holds a random token; only its SHA-256 hash is
 * stored, so a leaked database cannot be used to hijack a session.
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamps.createdAt,
});

/** Non-secret app settings as JSON values (model choice, rule weights, ...). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: timestamps.updatedAt,
});

/** Secrets encrypted with AES-256-GCM (see src/lib/crypto/secrets.ts). */
export const secrets = sqliteTable("secrets", {
  name: text("name").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  last4: text("last4").notNull(),
  updatedAt: timestamps.updatedAt,
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: timestamps.createdAt,
  action: text("action").notNull(),
  detail: text("detail", { mode: "json" }),
  ip: text("ip"),
});

/* ---------------------------------- Phase 1: Associates ---------------------------------- */

export const associates = sqliteTable(
  "associates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Never sent to Claude: replaced with an alias by the privacy layer. */
    name: text("name").notNull(),
    email: text("email"),
    title: text("title"),
    /** IANA zone, e.g. America/Chicago. */
    timeZone: text("time_zone").notNull(),
    canPm: integer("can_pm", { mode: "boolean" }).notNull().default(false),
    canPayroll: integer("can_payroll", { mode: "boolean" }).notNull().default(false),
    /** Personal target load in weighted units (healthy band is 5-10). */
    targetLoad: real("target_load").notNull().default(8),
    /** Controls who appears in Cadence. */
    isDirectlyManaged: integer("is_directly_managed", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    /** Free text about strengths and preferences; read by Claude after scrubbing. */
    capabilityNotes: text("capability_notes").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("associates_name_unique").on(sql`lower(${t.name})`)],
);

export const capabilities = sqliteTable(
  "capabilities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("capabilities_name_unique").on(sql`lower(${t.name})`)],
);

/** Proficiency: 1 = learning, 2 = proficient, 3 = expert. */
export const associateCapabilities = sqliteTable(
  "associate_capabilities",
  {
    associateId: integer("associate_id")
      .notNull()
      .references(() => associates.id, { onDelete: "cascade" }),
    capabilityId: integer("capability_id")
      .notNull()
      .references(() => capabilities.id, { onDelete: "cascade" }),
    proficiency: integer("proficiency").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.associateId, t.capabilityId] }),
    index("associate_capabilities_capability_idx").on(t.capabilityId),
  ],
);

/** Dates are calendar dates as YYYY-MM-DD, inclusive at both ends. */
export const associatePto = sqliteTable(
  "associate_pto",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    associateId: integer("associate_id")
      .notNull()
      .references(() => associates.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    /** Partial day off (single-day entries only). */
    isPartialDay: integer("is_partial_day", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("associate_pto_associate_dates_idx").on(t.associateId, t.startDate)],
);
