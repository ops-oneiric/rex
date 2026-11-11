"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { assign, AssignmentError, unassign } from "@/lib/assignments/data";
import { SEATS } from "@/lib/assignments/seats";
import type { FormResult } from "@/lib/forms";
import { clientIp } from "@/lib/request";

const assignInput = z.object({
  clientId: z.number().int().positive(),
  seat: z.enum(SEATS),
  associateId: z.number().int().positive(),
  overrideNote: z.string().trim().max(300).nullable().optional(),
});

function refresh(clientId: number) {
  revalidatePath("/", "layout");
  revalidatePath(`/clients/${clientId}`);
}

export async function assignAction(input: z.input<typeof assignInput>): Promise<FormResult> {
  await requireAdmin();
  const parsed = assignInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That request was not valid." };
  try {
    assign(parsed.data);
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, message: error.message };
    throw error;
  }
  audit("assignment.created", { ...parsed.data, override: Boolean(parsed.data.overrideNote) }, await clientIp());
  refresh(parsed.data.clientId);
  return { ok: true, message: "Assigned." };
}

export async function unassignAction(assignmentId: number): Promise<FormResult> {
  await requireAdmin();
  const removed = unassign(assignmentId);
  if (!removed) return { ok: false, message: "That assignment was already ended." };
  audit("assignment.ended", { id: assignmentId, clientId: removed.clientId }, await clientIp());
  refresh(removed.clientId);
  return { ok: true, message: "Unassigned." };
}
