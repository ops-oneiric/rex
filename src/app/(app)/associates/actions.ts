"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import {
  addPto,
  createAssociate,
  deleteAssociate,
  deletePto,
  DuplicateNameError,
  getAssociate,
  PtoOverlapError,
  saveAssociateCapabilities,
  setAssociateActive,
  updateAssociate,
} from "@/lib/associates/data";
import {
  associateSchema,
  capabilityNotesSchema,
  proficiencySchema,
  ptoSchema,
} from "@/lib/associates/validation";
import { formatDateRange } from "@/lib/dates";
import { checkbox, fieldErrors, formValues, type FormResult } from "@/lib/forms";
import { clientIp } from "@/lib/request";

function parseAssociate(formData: FormData) {
  return associateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    title: String(formData.get("title") ?? ""),
    timeZone: String(formData.get("timeZone") ?? ""),
    canPm: checkbox(formData, "canPm"),
    canPayroll: checkbox(formData, "canPayroll"),
    targetLoad: String(formData.get("targetLoad") ?? ""),
    isDirectlyManaged: checkbox(formData, "isDirectlyManaged"),
  });
}

const DUPLICATE_NAME = "An associate with this name already exists. Add a middle initial or similar to tell them apart.";

function refresh(id?: number) {
  revalidatePath("/associates");
  if (id) revalidatePath(`/associates/${id}`);
  revalidatePath("/");
}

function requireAssociate(id: number) {
  const associate = getAssociate(id);
  if (!associate) redirect("/associates");
  return associate;
}

export async function createAssociateAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  const parsed = parseAssociate(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData) };

  let id: number;
  try {
    id = createAssociate(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateNameError) return { errors: { name: DUPLICATE_NAME }, values: formValues(formData) };
    throw error;
  }
  audit("associate.created", { id }, await clientIp());
  refresh();
  redirect(`/associates/${id}?tab=capabilities&created=1`);
}

export async function updateAssociateAction(
  id: number,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  requireAssociate(id);
  const parsed = parseAssociate(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(formData) };

  try {
    updateAssociate(id, parsed.data);
  } catch (error) {
    if (error instanceof DuplicateNameError) return { errors: { name: DUPLICATE_NAME }, values: formValues(formData) };
    throw error;
  }
  audit("associate.updated", { id }, await clientIp());
  refresh(id);
  redirect(`/associates/${id}`);
}

export async function setAssociateActiveAction(id: number, isActive: boolean) {
  await requireAdmin();
  requireAssociate(id);
  setAssociateActive(id, isActive);
  audit(isActive ? "associate.activated" : "associate.deactivated", { id }, await clientIp());
  refresh(id);
}

export async function deleteAssociateAction(id: number) {
  await requireAdmin();
  requireAssociate(id);
  deleteAssociate(id);
  audit("associate.deleted", { id }, await clientIp());
  refresh();
  redirect("/associates");
}

export async function saveCapabilitiesAction(
  id: number,
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  requireAssociate(id);

  const levels: { capabilityId: number; proficiency: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^cap_(\d+)$/.exec(key);
    if (!match) continue;
    const proficiency = proficiencySchema.safeParse(value);
    if (!proficiency.success) return { ok: false, message: "One of the levels was not recognized. Reload and try again." };
    levels.push({ capabilityId: Number(match[1]), proficiency: proficiency.data });
  }
  const notes = capabilityNotesSchema.safeParse(String(formData.get("capabilityNotes") ?? ""));
  if (!notes.success) return { ok: false, errors: { capabilityNotes: notes.error.issues[0]!.message } };

  saveAssociateCapabilities(id, levels, notes.data);
  audit("associate.capabilities_saved", { id, count: levels.filter((l) => l.proficiency > 0).length }, await clientIp());
  refresh(id);
  return { ok: true, message: "Capabilities saved." };
}

export async function addPtoAction(id: number, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireAdmin();
  requireAssociate(id);
  const values = formValues(formData);
  const parsed = ptoSchema.safeParse({
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? "") || String(formData.get("startDate") ?? ""),
    isPartialDay: checkbox(formData, "isPartialDay"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  try {
    addPto(id, parsed.data);
  } catch (error) {
    if (error instanceof PtoOverlapError) {
      return {
        errors: {
          startDate: `This overlaps existing PTO (${formatDateRange(error.existing.startDate, error.existing.endDate)}). Remove that entry first or change the dates.`,
        },
        values,
      };
    }
    throw error;
  }
  audit("pto.added", { associateId: id, ...parsed.data, note: undefined }, await clientIp());
  refresh(id);
  return { ok: true, message: `PTO added: ${formatDateRange(parsed.data.startDate, parsed.data.endDate)}.` };
}

export async function deletePtoAction(id: number, ptoId: number) {
  await requireAdmin();
  const removed = deletePto(id, ptoId);
  if (removed) {
    audit("pto.deleted", { associateId: id, startDate: removed.startDate, endDate: removed.endDate }, await clientIp());
  }
  refresh(id);
}
