"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { STAGE_LABELS, STAGES, type Stage } from "@/lib/clients/constants";
import {
  changeStage,
  createClient,
  deleteClient,
  DuplicateCodeError,
  getClient,
  updateClient,
} from "@/lib/clients/data";
import { clientSchema, stageChangeNoteSchema } from "@/lib/clients/validation";
import { fieldErrors, formValues, type FormResult } from "@/lib/forms";
import { clientIp } from "@/lib/request";

const DUPLICATE_CODE = "Another client already uses this company code.";

const FIELDS = [
  "companyCode",
  "displayName",
  "implementationType",
  "supportModel",
  "employeeCount",
  "firstInputDate",
  "benefitsStartDate",
  "timeZone",
  "controlCount",
  "payrollComplexity",
  "previousVendor",
  "notes",
] as const;

function parse(formData: FormData, stage: Stage) {
  const raw: Record<string, unknown> = { lifecycleStage: stage };
  for (const f of FIELDS) raw[f] = String(formData.get(f) ?? "");
  return clientSchema.safeParse(raw);
}

function refresh(id?: number) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
  revalidatePath("/");
}

export async function createClientAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const stageValue = String(formData.get("lifecycleStage") ?? "");
  const stage: Stage = (STAGES as readonly string[]).includes(stageValue) && stageValue !== "SERVICE"
    ? (stageValue as Stage)
    : "PROSPECT";
  const parsed = parse(formData, stage);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData) };

  let id: number;
  try {
    id = createClient(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateCodeError) return { errors: { companyCode: DUPLICATE_CODE }, values: formValues(formData) };
    throw error;
  }
  audit("client.created", { id, stage }, await clientIp());
  refresh();
  redirect(`/clients/${id}?created=1`);
}

export async function updateClientAction(id: number, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const client = getClient(id);
  if (!client) redirect("/clients");
  const parsed = parse(formData, client.lifecycleStage);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData) };

  try {
    updateClient(id, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateCodeError) return { errors: { companyCode: DUPLICATE_CODE }, values: formValues(formData) };
    throw error;
  }
  audit("client.updated", { id }, await clientIp());
  refresh(id);
  redirect(`/clients/${id}`);
}

export async function changeStageAction(
  id: number,
  to: Stage,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const note = stageChangeNoteSchema.safeParse(String(formData.get("note") ?? ""));
  if (!note.success) return { ok: false, errors: { note: note.error.issues[0]!.message } };

  const result = changeStage(id, to, note.data);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "missing"
          ? `Fill in these fields first: ${result.missing.join(", ")}.`
          : "That stage change is not allowed.",
    };
  }
  audit("client.stage_changed", { id, to }, await clientIp());
  refresh(id);
  return { ok: true, message: `Moved to ${STAGE_LABELS[to]}.` };
}

export async function deleteClientAction(id: number) {
  await requireAdmin();
  deleteClient(id);
  audit("client.deleted", { id }, await clientIp());
  refresh();
  redirect("/clients");
}
