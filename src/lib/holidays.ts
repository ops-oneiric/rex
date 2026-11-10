import "server-only";
import { asc, eq, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { usFederalHolidays, type HolidaySet } from "@/lib/business-days";

export type Holiday = typeof schema.holidays.$inferSelect;

export function listHolidays(): Holiday[] {
  return db.select().from(schema.holidays).orderBy(asc(schema.holidays.date)).all();
}

export function getHolidaySet(): HolidaySet {
  return new Set(db.select({ date: schema.holidays.date }).from(schema.holidays).all().map((h) => h.date));
}

export class DuplicateHolidayError extends Error {}

export function addHoliday(date: string, name: string) {
  const existing = db.select().from(schema.holidays).where(eq(schema.holidays.date, date)).get();
  if (existing) throw new DuplicateHolidayError();
  db.insert(schema.holidays).values({ date, name }).run();
}

export function removeHoliday(date: string) {
  db.delete(schema.holidays).where(eq(schema.holidays.date, date)).run();
}

/** Adds any missing US federal holidays for a year. Returns how many were added. */
export function addFederalHolidays(year: number): number {
  const rows = usFederalHolidays(year);
  const result = db.insert(schema.holidays).values(rows).onConflictDoNothing().run();
  return result.changes;
}

export function holidayYears(): number[] {
  const years = new Set(listHolidays().map((h) => Number(h.date.slice(0, 4))));
  return [...years].sort();
}

export function holidaysInYear(year: number): Holiday[] {
  return db
    .select()
    .from(schema.holidays)
    .where(like(schema.holidays.date, `${year}-%`))
    .orderBy(asc(schema.holidays.date))
    .all();
}
