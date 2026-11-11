import "server-only";
import { and, eq } from "drizzle-orm";
import { schema, type DB } from "@/lib/db";

const { assignments, clients } = schema;

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Assignment = typeof assignments.$inferSelect;

export function recomputeAssignedOn(tx: Tx, clientId: number) {
  const remaining = tx.select({ id: assignments.id }).from(assignments).where(eq(assignments.clientId, clientId)).all();
  if (remaining.length === 0) {
    tx.update(clients).set({ assignedOn: null }).where(eq(clients.id, clientId)).run();
  }
}

/** Ends an assignment, or deletes it if it started today (an undo, not history). */
export function endAssignment(tx: Tx, a: Assignment, today: string, reason: "UNASSIGNED" | "REPLACED" | "SERVICE") {
  if (a.startDate === today && reason !== "SERVICE") {
    tx.delete(assignments).where(eq(assignments.id, a.id)).run();
  } else {
    tx.update(assignments)
      .set({ status: "ENDED", endDate: today, endReason: reason, updatedAt: new Date() })
      .where(eq(assignments.id, a.id))
      .run();
  }
}

/** Ends all active assignments, e.g. when the client moves to Service. Returns how many. */
export function endAllAssignments(tx: Tx, clientId: number, today: string): number {
  const active = tx
    .select()
    .from(assignments)
    .where(and(eq(assignments.clientId, clientId), eq(assignments.status, "ACTIVE")))
    .all();
  for (const a of active) endAssignment(tx, a, today, "SERVICE");
  return active.length;
}
