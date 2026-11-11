"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { getAssociate } from "@/lib/associates/data";
import {
  addManualItem,
  analyzeEntry,
  createEntry,
  deleteEntry,
  deleteItem,
  generateTrend,
  getEntry,
  getItem,
  markPending,
  setItemStatus,
  TrendError,
  updateEntry,
  updateItem,
} from "@/lib/cadence/data";
import { addDays, isIsoDate } from "@/lib/dates";
import { formValues, type FormResult } from "@/lib/forms";
import { clientIp } from "@/lib/request";
import { today } from "@/lib/settings";

const entrySchema = z.object({
  occurredOn: z.string().refine(isIsoDate, "Enter the meeting date."),
  notes: z.string().trim().min(1, "Write your notes from the meeting.").max(20000, "Notes must be 20,000 characters or fewer."),
});

function parseEntry(formData: FormData) {
  const parsed = entrySchema.safeParse({
    occurredOn: String(formData.get("occurredOn") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (parsed.success && parsed.data.occurredOn > addDays(today(), 1)) {
    return { success: false as const, errors: { occurredOn: "The meeting date can't be in the future." } };
  }
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { success: false as const, errors };
  }
  return { success: true as const, data: parsed.data };
}

function refresh(associateId: number) {
  revalidatePath(`/associates/${associateId}`);
  revalidatePath("/cadence");
}

/** Runs the analysis after the response is sent, so saving is instant. */
function analyzeLater(entryId: number, associateId: number) {
  after(async () => {
    await analyzeEntry(entryId);
    audit("cadence.analyzed", { entryId, status: getEntry(entryId)?.analysisStatus });
    try {
      refresh(associateId);
    } catch {
      // The page polls for the result anyway.
    }
  });
}

export async function createEntryAction(associateId: number, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  if (!getAssociate(associateId)) return { ok: false, message: "Associate not found." };
  const parsed = parseEntry(formData);
  if (!parsed.success) return { errors: parsed.errors, values: formValues(formData) };
  const id = createEntry(associateId, parsed.data.occurredOn, parsed.data.notes);
  audit("cadence.created", { associateId, entryId: id }, await clientIp());
  analyzeLater(id, associateId);
  refresh(associateId);
  return { ok: true, message: "Saved. Claude is reading your notes." };
}

export async function updateEntryAction(entryId: number, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const entry = getEntry(entryId);
  if (!entry) return { ok: false, message: "That 1:1 no longer exists." };
  const parsed = parseEntry(formData);
  if (!parsed.success) return { errors: parsed.errors, values: formValues(formData) };
  const changed = updateEntry(entryId, parsed.data.occurredOn, parsed.data.notes);
  audit("cadence.updated", { entryId, notesChanged: changed }, await clientIp());
  if (changed) analyzeLater(entryId, entry.associateId);
  refresh(entry.associateId);
  return { ok: true, message: changed ? "Saved. Claude is reading the updated notes." : "Saved." };
}

export async function deleteEntryAction(entryId: number): Promise<FormResult> {
  await requireAdmin();
  const entry = getEntry(entryId);
  if (!entry) return { ok: true };
  deleteEntry(entryId);
  audit("cadence.deleted", { entryId, associateId: entry.associateId }, await clientIp());
  refresh(entry.associateId);
  return { ok: true };
}

export async function reanalyzeAction(entryId: number): Promise<FormResult> {
  await requireAdmin();
  const entry = getEntry(entryId);
  if (!entry) return { ok: false, message: "That 1:1 no longer exists." };
  markPending(entryId);
  analyzeLater(entryId, entry.associateId);
  refresh(entry.associateId);
  return { ok: true };
}

/* ---------------------------------------- Action items ---------------------------------------- */

export async function setItemStatusAction(itemId: number, status: "OPEN" | "DONE" | "DROPPED"): Promise<FormResult> {
  await requireAdmin();
  const item = getItem(itemId);
  if (!item) return { ok: false, message: "That item no longer exists." };
  setItemStatus(itemId, status);
  audit("action_item.changed", { itemId, status }, await clientIp());
  if (item.associateId) refresh(item.associateId);
  return { ok: true };
}

const itemSchema = z.object({
  text: z.string().trim().min(2, "Describe the action item.").max(300, "Keep it under 300 characters."),
  owner: z.enum(["ME", "ASSOCIATE"]),
});

export async function updateItemAction(itemId: number, input: { text: string; owner: "ME" | "ASSOCIATE" }): Promise<FormResult> {
  await requireAdmin();
  const item = getItem(itemId);
  if (!item) return { ok: false, message: "That item no longer exists." };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  updateItem(itemId, parsed.data);
  audit("action_item.changed", { itemId, edited: true }, await clientIp());
  if (item.associateId) refresh(item.associateId);
  return { ok: true };
}

export async function addItemAction(associateId: number, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const parsed = itemSchema.safeParse({ text: String(formData.get("text") ?? ""), owner: String(formData.get("owner") ?? "ME") });
  if (!parsed.success) return { ok: false, errors: { text: parsed.error.issues[0]!.message }, values: formValues(formData) };
  addManualItem(associateId, parsed.data.text, parsed.data.owner);
  audit("action_item.changed", { associateId, added: true }, await clientIp());
  refresh(associateId);
  return { ok: true };
}

export async function deleteItemAction(itemId: number): Promise<FormResult> {
  await requireAdmin();
  const item = getItem(itemId);
  if (!item) return { ok: true };
  deleteItem(itemId);
  audit("action_item.changed", { itemId, deleted: true }, await clientIp());
  if (item.associateId) refresh(item.associateId);
  return { ok: true };
}

/* ------------------------------------------- Trends ------------------------------------------- */

export async function trendAction(associateId: number): Promise<FormResult> {
  await requireAdmin();
  try {
    const report = await generateTrend(associateId);
    audit("trend.generated", { associateId, status: report.status, costUsd: report.costUsd }, await clientIp());
    refresh(associateId);
    return report.status === "DONE" ? { ok: true } : { ok: false, message: report.error ?? "The report failed." };
  } catch (error) {
    if (error instanceof TrendError) return { ok: false, message: error.message };
    throw error;
  }
}
