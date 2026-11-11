"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { assign, AssignmentError, unassign } from "@/lib/assignments/data";
import { SEATS } from "@/lib/assignments/seats";
import type { FormResult } from "@/lib/forms";
import { clientIp } from "@/lib/request";
import {
  acceptTeam,
  getRecommendation,
  previewForClient,
  RecommendationError,
  rejectRecommendation,
  runRecommendation,
} from "@/lib/ai/recommend/service";

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

/* --------------------------------------- Recommendations --------------------------------------- */

export async function recommendAction(clientId: number): Promise<FormResult & { recommendationId?: number }> {
  await requireAdmin();
  try {
    const id = await runRecommendation(clientId);
    const rec = getRecommendation(id);
    audit("ai.recommendation_requested", { clientId, recommendationId: id, status: rec?.status, costUsd: rec?.costUsd }, await clientIp());
    revalidatePath(`/assign/${clientId}`);
    if (rec?.status === "FAILED") return { ok: false, message: rec.error ?? "The request failed.", recommendationId: id };
    return { ok: true, recommendationId: id };
  } catch (error) {
    if (error instanceof RecommendationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function previewAction(clientId: number): Promise<FormResult & { payload?: string }> {
  await requireAdmin();
  try {
    return { ok: true, payload: previewForClient(clientId) };
  } catch (error) {
    if (error instanceof RecommendationError) return { ok: false, message: error.message };
    throw error;
  }
}

const acceptInput = z.object({
  recommendationId: z.number().int().positive(),
  teamIndex: z.number().int().min(0).max(2),
  choices: z.array(z.object({ seat: z.enum(SEATS), associateId: z.number().int().positive() })).min(1).max(3),
  reason: z.string().trim().max(500).nullable(),
});

export async function acceptTeamAction(input: z.input<typeof acceptInput>): Promise<FormResult> {
  await requireAdmin();
  const parsed = acceptInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That request was not valid." };
  const rec = getRecommendation(parsed.data.recommendationId);
  try {
    const { modified } = acceptTeam({ ...parsed.data, reason: parsed.data.reason || null });
    audit("ai.recommendation_decided", { recommendationId: parsed.data.recommendationId, outcome: modified ? "MODIFIED" : "ACCEPTED" }, await clientIp());
  } catch (error) {
    if (error instanceof RecommendationError) return { ok: false, message: error.message };
    throw error;
  }
  if (rec) refresh(rec.clientId);
  return { ok: true, message: "Team assigned." };
}

export async function rejectRecommendationAction(recommendationId: number, reason: string | null): Promise<FormResult> {
  await requireAdmin();
  const note = (reason ?? "").trim().slice(0, 500) || null;
  try {
    rejectRecommendation(recommendationId, note);
  } catch (error) {
    if (error instanceof RecommendationError) return { ok: false, message: error.message };
    throw error;
  }
  audit("ai.recommendation_decided", { recommendationId, outcome: "REJECTED" }, await clientIp());
  const rec = getRecommendation(recommendationId);
  if (rec) revalidatePath(`/assign/${rec.clientId}`);
  return { ok: true, message: "Noted. Choose the team from the ranked list below." };
}
