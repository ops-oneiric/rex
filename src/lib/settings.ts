import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { DEFAULT_MODEL, isSupportedModel, type ModelId } from "@/lib/ai/models";
import { todayIn } from "@/lib/dates";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/time-zones";

const AI_KEY_SECRET = "anthropic_api_key";
const AI_MODEL_SETTING = "ai.model";
const HOME_TIME_ZONE_SETTING = "app.timeZone";

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
