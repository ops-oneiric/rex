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
import { getAiModel, removeApiKey, saveApiKey, setAiModel, setHomeTimeZone } from "@/lib/settings";
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
