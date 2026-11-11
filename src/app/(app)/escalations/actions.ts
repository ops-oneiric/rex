"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { addDays, isIsoDate } from "@/lib/dates";
import { ESCALATION_CATEGORIES, FAULT_PARTIES, PREVENTABLE, SEVERITIES } from "@/lib/escalations/constants";
import {
  analyzeEscalation,
  confirmEscalation,
  createEscalation,
  deleteEscalation,
  EscalationTrendError,
  generateEscalationTrend,
  getEscalation,
  markPending,
  previewEscalation,
  setEscalationStatus,
  updateEscalationDetails,
} from "@/lib/escalations/data";
import { formValues, type FormResult } from "@/lib/forms";
import { clientIp } from "@/lib/request";
import { today } from "@/lib/settings";

const entrySchema = z.object({
  occurredOn: z.string().refine(isIsoDate, "Enter the date of the escalation."),
  details: z.string().trim().min(10, "Describe what happened.").max(20000, "Details must be 20,000 characters or fewer."),
});

function parse(formData: FormData) {
  const parsed = entrySchema.safeParse({ occurredOn: String(formData.get("occurredOn") ?? ""), details: String(formData.get("details") ?? "") });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { success: false as const, errors };
  }
  if (parsed.data.occurredOn > addDays(today(), 1)) return { success: false as const, errors: { occurredOn: "The date can't be in the future." } };
  return { success: true as const, data: parsed.data };
}

function refresh(id?: number) {
  revalidatePath("/escalations");
  if (id) revalidatePath(`/escalations/${id}`);
  revalidatePath("/", "layout");
}

/** Runs the analysis after the response is sent, so saving is instant. */
function analyzeLater(id: number) {
  after(async () => {
    await analyzeEscalation(id);
    audit("escalation.analyzed", { id, status: getEscalation(id)?.analysisStatus });
    try {
      refresh(id);
    } catch {
      // The page polls for the result anyway.
    }
  });
}

export async function createEscalationAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return { errors: parsed.errors, values: formValues(formData) };
  const id = createEscalation(parsed.data.occurredOn, parsed.data.details);
  audit("escalation.created", { id }, await clientIp());
  analyzeLater(id);
  refresh();
  redirect(`/escalations/${id}`);
}

export async function previewEscalationAction(occurredOn: string, details: string): Promise<FormResult & { payload?: string }> {
  await requireAdmin();
  if (details.trim().length < 10) return { ok: false, message: "Write the details first." };
  return { ok: true, payload: previewEscalation(isIsoDate(occurredOn) ? occurredOn : today(), details.slice(0, 20000)) };
}

export async function updateDetailsAction(id: number, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  if (!getEscalation(id)) return { ok: false, message: "That escalation no longer exists." };
  const parsed = parse(formData);
  if (!parsed.success) return { errors: parsed.errors, values: formValues(formData) };
  const changed = updateEscalationDetails(id, parsed.data.occurredOn, parsed.data.details);
  audit("escalation.updated", { id, detailsChanged: changed }, await clientIp());
  if (changed) analyzeLater(id);
  refresh(id);
  return { ok: true, message: changed ? "Saved. Claude is reviewing the updated details." : "Saved." };
}

export async function reanalyzeEscalationAction(id: number): Promise<FormResult> {
  await requireAdmin();
  if (!getEscalation(id)) return { ok: false, message: "That escalation no longer exists." };
  markPending(id);
  analyzeLater(id);
  refresh(id);
  return { ok: true };
}

const confirmSchema = z.object({
  clientId: z.number().int().positive().nullable(),
  summary: z.string().trim().min(1, "Add a short summary.").max(1000),
  associateIds: z.array(z.number().int().positive()).max(20),
  faultAssociateIds: z.array(z.number().int().positive()).max(20),
  category: z.enum(ESCALATION_CATEGORIES),
  severity: z.enum(SEVERITIES),
  faultParty: z.enum(FAULT_PARTIES),
  faultRationale: z.string().trim().max(2000),
  rootCause: z.string().trim().max(1000),
  preventable: z.enum(PREVENTABLE),
  actions: z.array(z.object({ text: z.string().trim().min(2).max(300), owner: z.enum(["ME", "ASSOCIATE"]) })).max(5),
});

export async function confirmEscalationAction(id: number, input: z.input<typeof confirmSchema>): Promise<FormResult> {
  await requireAdmin();
  if (!getEscalation(id)) return { ok: false, message: "That escalation no longer exists." };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  if (parsed.data.faultParty === "ASSOCIATE" && parsed.data.faultAssociateIds.length === 0) {
    return { ok: false, message: "Fault is with an associate: tick who, or choose a different fault." };
  }
  confirmEscalation(id, parsed.data);
  audit("escalation.confirmed", { id, faultParty: parsed.data.faultParty, severity: parsed.data.severity }, await clientIp());
  refresh(id);
  return { ok: true, message: "Confirmed. It now counts in escalation trends." };
}

export async function setEscalationStatusAction(id: number, status: "OPEN" | "RESOLVED"): Promise<FormResult> {
  await requireAdmin();
  if (!getEscalation(id)) return { ok: false, message: "That escalation no longer exists." };
  setEscalationStatus(id, status);
  audit("escalation.status_changed", { id, status }, await clientIp());
  refresh(id);
  return { ok: true };
}

export async function deleteEscalationAction(id: number) {
  await requireAdmin();
  deleteEscalation(id);
  audit("escalation.deleted", { id }, await clientIp());
  refresh();
  redirect("/escalations");
}

export async function escalationTrendAction(): Promise<FormResult> {
  await requireAdmin();
  try {
    const report = await generateEscalationTrend();
    audit("trend.generated", { subject: "ESCALATIONS", status: report.status, costUsd: report.costUsd }, await clientIp());
    refresh();
    return report.status === "DONE" ? { ok: true } : { ok: false, message: report.error ?? "The report failed." };
  } catch (error) {
    if (error instanceof EscalationTrendError) return { ok: false, message: error.message };
    throw error;
  }
}
