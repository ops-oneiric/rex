"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { ADMIN_ID, getAdmin } from "@/lib/auth/admin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validateNewPassword } from "@/lib/auth/policy";
import { destroyOtherSessions } from "@/lib/auth/session";
import { testConnection } from "@/lib/ai/client";
import { isSupportedModel } from "@/lib/ai/models";
import { EncryptionKeyError } from "@/lib/crypto/secrets";
import { clientIp } from "@/lib/request";
import {
  getAiModel,
  removeApiKey,
  saveApiKey,
  setAiModel,
  setCadenceDays,
  setComplexityScale,
  setExtraNames,
  setHomeTimeZone,
  setRuleSettings,
  setWeightSettings,
} from "@/lib/settings";
import { DEFAULT_RULES, ruleSettingsSchema } from "@/lib/assignments/rules";
import { DEFAULT_WEIGHTS, weightSettingsSchema } from "@/lib/clients/weight";
import { isIsoDate } from "@/lib/dates";
import { addFederalHolidays, addHoliday, DuplicateHolidayError, removeHoliday } from "@/lib/holidays";
import {
  createCapability,
  deleteCapability,
  DuplicateNameError,
  updateCapability,
} from "@/lib/associates/data";
import { capabilitySchema } from "@/lib/associates/validation";
import { fieldErrors, formValues, type FormResult } from "@/lib/forms";
import { isValidTimeZone } from "@/lib/time-zones";

export type FormState = { ok?: boolean; message?: string };

export async function saveApiKeyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (apiKey.length < 20 || /\s/.test(apiKey)) {
    return { ok: false, message: "That does not look like a complete API key." };
  }
  try {
    saveApiKey(apiKey);
  } catch (error) {
    if (error instanceof EncryptionKeyError) return { ok: false, message: error.message };
    throw error;
  }
  audit("ai.key_saved", { last4: apiKey.slice(-4) }, await clientIp());
  revalidatePath("/", "layout");

  const result = await testConnection(getAiModel());
  return result.ok
    ? { ok: true, message: `Key saved. ${result.message}` }
    : { ok: false, message: `Key saved, but the connection test failed: ${result.message}` };
}

export async function removeApiKeyAction(): Promise<void> {
  await requireAdmin();
  removeApiKey();
  audit("ai.key_removed", null, await clientIp());
  revalidatePath("/", "layout");
}

export async function saveModelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const model = String(formData.get("model") ?? "");
  if (!isSupportedModel(model)) return { ok: false, message: "Choose a model from the list." };
  setAiModel(model);
  audit("ai.model_changed", { model }, await clientIp());
  revalidatePath("/settings");
  return { ok: true, message: "Model saved." };
}

export async function testConnectionAction(): Promise<FormState> {
  await requireAdmin();
  return testConnection(getAiModel());
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const admin = getAdmin();
  if (!admin) return { ok: false, message: "Admin account not found." };
  if (!(await verifyPassword(admin.passwordHash, current))) {
    return { ok: false, message: "Your current password is incorrect." };
  }
  if (next !== confirm) return { ok: false, message: "The new passwords do not match." };
  const problem = validateNewPassword(next, admin.username);
  if (problem) return { ok: false, message: problem };

  db.update(schema.adminUser)
    .set({ passwordHash: await hashPassword(next), passwordChangedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.adminUser.id, ADMIN_ID))
    .run();
  await destroyOtherSessions();
  audit("password.changed", null, await clientIp());
  return { ok: true, message: "Password changed. Any other signed-in browsers were signed out." };
}

/* ---------------------------- General and capabilities ---------------------------- */

export async function saveTimeZoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const timeZone = String(formData.get("timeZone") ?? "");
  if (!isValidTimeZone(timeZone)) return { ok: false, message: "Choose a time zone from the list." };
  setHomeTimeZone(timeZone);
  audit("settings.time_zone_changed", { timeZone }, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: "Time zone saved." };
}

export async function createCapabilityAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const parsed = capabilitySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData) };
  try {
    createCapability(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateNameError) {
      return { errors: { name: "A capability with this name already exists." }, values: formValues(formData) };
    }
    throw error;
  }
  audit("capability.created", { name: parsed.data.name }, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: `Added "${parsed.data.name}".` };
}

export async function updateCapabilityAction(
  id: number,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const parsed = capabilitySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData) };
  try {
    updateCapability(id, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateNameError) {
      return { errors: { name: "A capability with this name already exists." }, values: formValues(formData) };
    }
    throw error;
  }
  audit("capability.updated", { id, name: parsed.data.name }, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCapabilityAction(id: number) {
  await requireAdmin();
  deleteCapability(id);
  audit("capability.deleted", { id }, await clientIp());
  revalidatePath("/", "layout");
}

/* --------------------------------- Clients & rules --------------------------------- */

export async function saveWeightsAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const n = (key: string) => Number(String(formData.get(key) ?? "").trim() || NaN);
  const parsed = weightSettingsSchema.safeParse({
    base: n("base"),
    employees50: n("employees50"),
    employees200: n("employees200"),
    employees500: n("employees500"),
    perExtraControl: n("perExtraControl"),
    controlCap: n("controlCap"),
    complexity: [1, 2, 3, 4, 5].map((i) => n(`complexity${i}`)),
    newLogo: n("newLogo"),
    addControl: n("addControl"),
    inHouse: n("inHouse"),
    newVendor: n("newVendor"),
    fastStart: n("fastStart"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Every value must be a number from 0 to 5.", values: formValues(formData) };
  }
  setWeightSettings(parsed.data);
  audit("settings.weights_changed", parsed.data, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: "Weights saved. Every client's weight now uses them." };
}

export async function resetWeightsAction(): Promise<FormResult> {
  await requireAdmin();
  setWeightSettings(DEFAULT_WEIGHTS);
  audit("settings.weights_changed", { reset: true }, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: "Weights reset to the defaults." };
}

export async function saveComplexityScaleAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const scale = [1, 2, 3, 4, 5].map((i) => String(formData.get(`level${i}`) ?? "").trim());
  if (scale.some((s) => s.length === 0 || s.length > 200)) {
    return { ok: false, message: "Describe every level in 200 characters or fewer.", values: formValues(formData) };
  }
  setComplexityScale(scale as [string, string, string, string, string]);
  audit("settings.complexity_changed", null, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: "Complexity scale saved." };
}

export async function addHolidayAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const errors: Record<string, string> = {};
  if (!isIsoDate(date)) errors.date = "Enter a date.";
  if (!name || name.length > 80) errors.name = "Enter a name of up to 80 characters.";
  if (Object.keys(errors).length) return { errors, values: formValues(formData) };
  try {
    addHoliday(date, name);
  } catch (error) {
    if (error instanceof DuplicateHolidayError) {
      return { errors: { date: "That date is already a holiday." }, values: formValues(formData) };
    }
    throw error;
  }
  audit("holiday.added", { date, name }, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: `Added ${name}.` };
}

export async function removeHolidayAction(date: string) {
  await requireAdmin();
  removeHoliday(date);
  audit("holiday.removed", { date }, await clientIp());
  revalidatePath("/", "layout");
}

export async function addFederalHolidaysAction(year: number): Promise<FormResult> {
  await requireAdmin();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, message: "Choose a valid year." };
  const added = addFederalHolidays(year);
  audit("holiday.added", { federalYear: year, added }, await clientIp());
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: added ? `Added ${added} US federal holiday${added === 1 ? "" : "s"} for ${year}.` : `All ${year} federal holidays were already listed.`,
  };
}

export async function saveRulesAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const raw = Object.fromEntries(
    Object.keys(DEFAULT_RULES).map((k) => [k, Number(String(formData.get(k) ?? "").trim() || NaN)]),
  );
  const parsed = ruleSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Check the values: windows are whole numbers and shares are between 0 and 1." };
  const r = parsed.data;
  if (!(r.bandHealthy <= r.bandFull && r.bandFull <= r.bandOver)) {
    return { ok: false, message: "Load bands must go up: Healthy from, then Full above, then Over above." };
  }
  if (r.collisionClose < r.collisionConflict) {
    return { ok: false, message: "The 'close' window must be at least as wide as the 'conflict' window." };
  }
  setRuleSettings(r);
  audit("settings.rules_changed", r, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: "Assignment rules saved." };
}

export async function resetRulesAction(): Promise<FormResult> {
  await requireAdmin();
  setRuleSettings(DEFAULT_RULES);
  audit("settings.rules_changed", { reset: true }, await clientIp());
  revalidatePath("/", "layout");
  return { ok: true, message: "Assignment rules reset to the defaults." };
}

export async function savePrivacyAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const names = String(formData.get("extraNames") ?? "")
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length >= 2);
  if (names.length > 500 || names.some((n) => n.length > 100)) {
    return { ok: false, message: "Use up to 500 names of 100 characters or fewer, one per line." };
  }
  setExtraNames([...new Set(names)]);
  audit("settings.privacy_changed", { extraNames: names.length }, await clientIp());
  return { ok: true, message: `Saved ${names.length} name${names.length === 1 ? "" : "s"} to scrub.` };
}

export async function saveCadenceDaysAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const days = Number(String(formData.get("cadenceDays") ?? ""));
  if (!Number.isInteger(days) || days < 1 || days > 90) return { ok: false, message: "Enter a whole number of days from 1 to 90." };
  setCadenceDays(days);
  audit("settings.cadence_changed", { days }, await clientIp());
  revalidatePath("/cadence");
  return { ok: true, message: "1:1 rhythm saved." };
}
