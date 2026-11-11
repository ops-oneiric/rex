import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { DEFAULT_MODEL, isSupportedModel, type ModelId } from "@/lib/ai/models";
import { todayIn } from "@/lib/dates";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/time-zones";
import { DEFAULT_WEIGHTS, weightSettingsSchema, type WeightSettings } from "@/lib/clients/weight";
import { DEFAULT_COMPLEXITY_SCALE } from "@/lib/clients/constants";
import { DEFAULT_RULES, ruleSettingsSchema, type RuleSettings } from "@/lib/assignments/rules";
import { z } from "zod";

const AI_KEY_SECRET = "anthropic_api_key";
const AI_MODEL_SETTING = "ai.model";
const HOME_TIME_ZONE_SETTING = "app.timeZone";
const WEIGHTS_SETTING = "rules.weights";
const COMPLEXITY_SCALE_SETTING = "clients.complexityScale";
const RULES_SETTING = "rules.assignment";
const EXTRA_NAMES_SETTING = "privacy.extraNames";

function getSetting<T>(key: string): T | undefined {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row?.value as T | undefined;
}

function setSetting(key: string, value: unknown) {
  db.insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })
    .run();
}

/** Your own time zone. Decides what "today" means across Rex. */
export function getHomeTimeZone(): string {
  const stored = getSetting<string>(HOME_TIME_ZONE_SETTING);
  return stored && isValidTimeZone(stored) ? stored : DEFAULT_TIME_ZONE;
}

export function setHomeTimeZone(timeZone: string) {
  setSetting(HOME_TIME_ZONE_SETTING, timeZone);
}

export function today(): string {
  return todayIn(getHomeTimeZone());
}

export function getAiModel(): ModelId {
  const stored = getSetting<string>(AI_MODEL_SETTING);
  return stored && isSupportedModel(stored) ? stored : DEFAULT_MODEL;
}

export function setAiModel(model: ModelId) {
  setSetting(AI_MODEL_SETTING, model);
}

export type ApiKeyStatus = { configured: false } | { configured: true; last4: string; updatedAt: Date };

export function getApiKeyStatus(): ApiKeyStatus {
  const row = db.select().from(schema.secrets).where(eq(schema.secrets.name, AI_KEY_SECRET)).get();
  return row ? { configured: true, last4: row.last4, updatedAt: row.updatedAt } : { configured: false };
}

/** Decrypted key, for server-side API calls only. Never return this to the browser. */
export function getApiKey(): string | null {
  const row = db.select().from(schema.secrets).where(eq(schema.secrets.name, AI_KEY_SECRET)).get();
  return row ? decryptSecret(row.ciphertext) : null;
}

export function saveApiKey(apiKey: string) {
  const ciphertext = encryptSecret(apiKey);
  const last4 = apiKey.slice(-4);
  db.insert(schema.secrets)
    .values({ name: AI_KEY_SECRET, ciphertext, last4 })
    .onConflictDoUpdate({
      target: schema.secrets.name,
      set: { ciphertext, last4, updatedAt: new Date() },
    })
    .run();
}

export function removeApiKey() {
  db.delete(schema.secrets).where(eq(schema.secrets.name, AI_KEY_SECRET)).run();
}

/** Workload weight settings, falling back to defaults if missing or invalid. */
export function getWeightSettings(): WeightSettings {
  const parsed = weightSettingsSchema.safeParse(getSetting(WEIGHTS_SETTING));
  return parsed.success ? parsed.data : DEFAULT_WEIGHTS;
}

export function setWeightSettings(weights: WeightSettings) {
  setSetting(WEIGHTS_SETTING, weights);
}

const complexityScaleSchema = z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]);

/** Descriptions for payroll complexity 1-5. */
export function getComplexityScale(): [string, string, string, string, string] {
  const parsed = complexityScaleSchema.safeParse(getSetting(COMPLEXITY_SCALE_SETTING));
  return parsed.success ? parsed.data : DEFAULT_COMPLEXITY_SCALE;
}

export function setComplexityScale(scale: [string, string, string, string, string]) {
  setSetting(COMPLEXITY_SCALE_SETTING, scale);
}

/** Assignment rule settings (PTO windows, collisions, seat shares, bands). */
export function getRuleSettings(): RuleSettings {
  const parsed = ruleSettingsSchema.safeParse(getSetting(RULES_SETTING));
  return parsed.success ? parsed.data : DEFAULT_RULES;
}

export function setRuleSettings(rules: RuleSettings) {
  setSetting(RULES_SETTING, rules);
}

/** Extra names (e.g. client contacts) the privacy layer replaces with [NAME]. */
export function getExtraNames(): string[] {
  const parsed = z.array(z.string()).safeParse(getSetting(EXTRA_NAMES_SETTING));
  return parsed.success ? parsed.data : [];
}

export function setExtraNames(names: string[]) {
  setSetting(EXTRA_NAMES_SETTING, names);
}

const CADENCE_DAYS_SETTING = "cadence.frequencyDays";

/** Expected days between 1:1s; a 1:1 is overdue after this. Default every two weeks. */
export function getCadenceDays(): number {
  const parsed = z.number().int().min(1).max(90).safeParse(getSetting(CADENCE_DAYS_SETTING));
  return parsed.success ? parsed.data : 14;
}

export function setCadenceDays(days: number) {
  setSetting(CADENCE_DAYS_SETTING, days);
}

const BACKUP_STATUS_SETTING = "backup.status";

export type BackupStatus = { lastSuccessAt: string | null; lastError: string | null; lastErrorAt: string | null };

/** Outcome of the most recent backup attempts, so Settings and the dashboard can warn. */
export function getBackupStatus(): BackupStatus {
  return { lastSuccessAt: null, lastError: null, lastErrorAt: null, ...getSetting<Partial<BackupStatus>>(BACKUP_STATUS_SETTING) };
}

export function setBackupStatus(status: BackupStatus) {
  setSetting(BACKUP_STATUS_SETTING, status);
}
