import "server-only";
import { and, asc, count, eq, gte, max, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { rangesOverlap } from "@/lib/dates";
import type { AssociateInput, CapabilityInput, PtoInput } from "./validation";

const { associates, capabilities, associateCapabilities, associatePto } = schema;

export type Associate = typeof associates.$inferSelect;
export type Capability = typeof capabilities.$inferSelect;
export type Pto = typeof associatePto.$inferSelect;

export class DuplicateNameError extends Error {}

/* --------------------------------- Associates --------------------------------- */

export type RosterRow = Associate & {
  capabilities: { name: string; proficiency: number }[];
  nextPto: Pick<Pto, "startDate" | "endDate" | "isPartialDay"> | null;
};

/** Every associate with capability chips (strongest first) and their next or current PTO. */
export function listRoster(today: string): RosterRow[] {
  const rows = db.select().from(associates).orderBy(asc(sql`lower(${associates.name})`)).all();

  const caps = db
    .select({
      associateId: associateCapabilities.associateId,
      name: capabilities.name,
      proficiency: associateCapabilities.proficiency,
      sortOrder: capabilities.sortOrder,
    })
    .from(associateCapabilities)
    .innerJoin(capabilities, eq(capabilities.id, associateCapabilities.capabilityId))
    .all();

  const pto = db
    .select()
    .from(associatePto)
    .where(gte(associatePto.endDate, today))
    .orderBy(asc(associatePto.startDate))
    .all();

  return rows.map((a) => ({
    ...a,
    capabilities: caps
      .filter((c) => c.associateId === a.id)
      .sort((x, y) => y.proficiency - x.proficiency || x.sortOrder - y.sortOrder)
      .map(({ name, proficiency }) => ({ name, proficiency })),
    nextPto: pto.find((p) => p.associateId === a.id) ?? null,
  }));
}

export function countAssociates(): number {
  return db.select({ n: count() }).from(associates).get()?.n ?? 0;
}

export function getAssociate(id: number): Associate | undefined {
  return db.select().from(associates).where(eq(associates.id, id)).get();
}

function assertUniqueName(name: string, exceptId?: number) {
  const clash = db
    .select({ id: associates.id })
    .from(associates)
    .where(
      and(
        sql`lower(${associates.name}) = lower(${name})`,
        exceptId ? ne(associates.id, exceptId) : undefined,
      ),
    )
    .get();
  if (clash) throw new DuplicateNameError();
}

export function createAssociate(input: AssociateInput): number {
  assertUniqueName(input.name);
  const row = db.insert(associates).values(input).returning({ id: associates.id }).get();
  return row.id;
}

export function updateAssociate(id: number, input: AssociateInput) {
  assertUniqueName(input.name, id);
  db.update(associates).set({ ...input, updatedAt: new Date() }).where(eq(associates.id, id)).run();
}

export function setAssociateActive(id: number, isActive: boolean) {
  db.update(associates).set({ isActive, updatedAt: new Date() }).where(eq(associates.id, id)).run();
}

/** Removes the associate with their capabilities and PTO (cascade). */
export function deleteAssociate(id: number) {
  db.delete(associates).where(eq(associates.id, id)).run();
}

/* -------------------------------- Capabilities -------------------------------- */

export type CapabilityWithUsage = Capability & { usedBy: number };

export function listCapabilities(): CapabilityWithUsage[] {
  return db
    .select({
      id: capabilities.id,
      name: capabilities.name,
      description: capabilities.description,
      sortOrder: capabilities.sortOrder,
      createdAt: capabilities.createdAt,
      updatedAt: capabilities.updatedAt,
      usedBy: sql<number>`count(${associateCapabilities.associateId})`,
    })
    .from(capabilities)
    .leftJoin(associateCapabilities, eq(associateCapabilities.capabilityId, capabilities.id))
    .groupBy(capabilities.id)
    .orderBy(asc(capabilities.sortOrder), asc(sql`lower(${capabilities.name})`))
    .all();
}

/** Every capability with this associate's proficiency (0 = none). */
export function getAssociateCapabilities(associateId: number) {
  return db
    .select({
      id: capabilities.id,
      name: capabilities.name,
      description: capabilities.description,
      proficiency: sql<number>`coalesce(${associateCapabilities.proficiency}, 0)`,
    })
    .from(capabilities)
    .leftJoin(
      associateCapabilities,
      and(
        eq(associateCapabilities.capabilityId, capabilities.id),
        eq(associateCapabilities.associateId, associateId),
      ),
    )
    .orderBy(asc(capabilities.sortOrder), asc(sql`lower(${capabilities.name})`))
    .all();
}

/** Replaces the associate's capability levels and notes in one transaction. */
export function saveAssociateCapabilities(
  associateId: number,
  levels: { capabilityId: number; proficiency: number }[],
  notes: string,
) {
  const known = new Set(db.select({ id: capabilities.id }).from(capabilities).all().map((c) => c.id));
  db.transaction((tx) => {
    tx.delete(associateCapabilities).where(eq(associateCapabilities.associateId, associateId)).run();
    const rows = levels
      .filter((l) => l.proficiency > 0 && known.has(l.capabilityId))
      .map((l) => ({ associateId, ...l }));
    if (rows.length) tx.insert(associateCapabilities).values(rows).run();
    tx.update(associates)
      .set({ capabilityNotes: notes, updatedAt: new Date() })
      .where(eq(associates.id, associateId))
      .run();
  });
}

function assertUniqueCapability(name: string, exceptId?: number) {
  const clash = db
    .select({ id: capabilities.id })
    .from(capabilities)
    .where(
      and(
        sql`lower(${capabilities.name}) = lower(${name})`,
        exceptId ? ne(capabilities.id, exceptId) : undefined,
      ),
    )
    .get();
  if (clash) throw new DuplicateNameError();
}

export function createCapability(input: CapabilityInput) {
  assertUniqueCapability(input.name);
  const last = db.select({ m: max(capabilities.sortOrder) }).from(capabilities).get()?.m ?? 0;
  db.insert(capabilities).values({ ...input, sortOrder: last + 10 }).run();
}

export function updateCapability(id: number, input: CapabilityInput) {
  assertUniqueCapability(input.name, id);
  db.update(capabilities).set({ ...input, updatedAt: new Date() }).where(eq(capabilities.id, id)).run();
}

export function deleteCapability(id: number) {
  db.delete(capabilities).where(eq(capabilities.id, id)).run();
}

/* ------------------------------------ PTO ------------------------------------- */

export function listPto(associateId: number): Pto[] {
  return db
    .select()
    .from(associatePto)
    .where(eq(associatePto.associateId, associateId))
    .orderBy(asc(associatePto.startDate))
    .all();
}

export class PtoOverlapError extends Error {
  constructor(public readonly existing: Pto) {
    super("PTO overlaps an existing entry.");
  }
}

export function addPto(associateId: number, input: PtoInput) {
  const clash = listPto(associateId).find((p) =>
    rangesOverlap(p.startDate, p.endDate, input.startDate, input.endDate),
  );
  if (clash) throw new PtoOverlapError(clash);
  db.insert(associatePto).values({ associateId, ...input }).run();
}

export function deletePto(associateId: number, ptoId: number): Pto | undefined {
  return db
    .delete(associatePto)
    .where(and(eq(associatePto.id, ptoId), eq(associatePto.associateId, associateId)))
    .returning()
    .get();
}
