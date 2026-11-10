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

/* ----------------------------------- Phase 2: Clients ------------------------------------ */

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Exactly 3 uppercase letters or digits. Optional for prospects. Coded before sending to Claude. */
    companyCode: text("company_code"),
    /** Optional label. Never sent to Claude. */
    displayName: text("display_name"),
    lifecycleStage: text("lifecycle_stage", { enum: ["PROSPECT", "IMPLEMENTATION", "SERVICE"] }).notNull(),
    implementationType: text("implementation_type", { enum: ["NEW_LOGO", "ADD_CONTROL"] }),
    supportModel: text("support_model", { enum: ["HYBRID", "TRADITIONAL", "PM"] }),
    employeeCount: integer("employee_count"),
    /** Go-live / first payroll, YYYY-MM-DD. The main date for assignment. */
    firstInputDate: text("first_input_date"),
    benefitsStartDate: text("benefits_start_date"),
    timeZone: text("time_zone"),
    controlCount: integer("control_count"),
    payrollComplexity: integer("payroll_complexity"),
    previousVendor: text("previous_vendor", { enum: ["IN_HOUSE", "NEW"] }),
    notes: text("notes").notNull().default(""),
    /** Date the team was assigned (set in Phase 3); fixes the fast start flag. */
    assignedOn: text("assigned_on"),
    stageChangedAt: integer("stage_changed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("clients_company_code_unique").on(t.companyCode),
    index("clients_stage_idx").on(t.lifecycleStage),
    index("clients_first_input_idx").on(t.firstInputDate),
  ],
);

export const clientStageHistory = sqliteTable(
  "client_stage_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Null for the entry recorded when the client was created. */
    fromStage: text("from_stage", { enum: ["PROSPECT", "IMPLEMENTATION", "SERVICE"] }),
    toStage: text("to_stage", { enum: ["PROSPECT", "IMPLEMENTATION", "SERVICE"] }).notNull(),
    changedAt: timestamps.createdAt,
    note: text("note").notNull().default(""),
  },
  (t) => [index("client_stage_history_client_idx").on(t.clientId, t.changedAt)],
);

/** Non-working days excluded from business-day counts. */
export const holidays = sqliteTable("holidays", {
  date: text("date").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamps.createdAt,
});
