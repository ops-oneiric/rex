/**
 * Business-day math. A business day is a weekday that is not in the holiday list.
 * Dates are "YYYY-MM-DD" strings (see src/lib/dates.ts).
 */
import { addDays } from "./dates";

export type HolidaySet = ReadonlySet<string>;

function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export function isBusinessDay(iso: string, holidays: HolidaySet): boolean {
  const day = weekday(iso);
  return day !== 0 && day !== 6 && !holidays.has(iso);
}

/**
 * Business days after `from`, up to and including `to`. Assigning on a Monday with
 * first input the next Monday gives 5. Negative when `to` is before `from`.
 */
export function businessDaysBetween(from: string, to: string, holidays: HolidaySet): number {
  if (from === to) return 0;
  const forward = to > from;
  const [start, end] = forward ? [from, to] : [to, from];
  let count = 0;
  for (let d = addDays(start, 1); d <= end; d = addDays(d, 1)) {
    if (isBusinessDay(d, holidays)) count += 1;
  }
  return forward ? count : -count;
}

/** The date `n` business days after `from` (n > 0) or before it (n < 0). */
export function addBusinessDays(from: string, n: number, holidays: HolidaySet): string {
  let d = from;
  let remaining = Math.abs(n);
  const step = n >= 0 ? 1 : -1;
  while (remaining > 0) {
    d = addDays(d, step);
    if (isBusinessDay(d, holidays)) remaining -= 1;
  }
  return d;
}

/** Fewer than this many business days from assignment to first input is a fast start. */
export const FAST_START_BUSINESS_DAYS = 20;

export function isFastStart(assignedOn: string, firstInputDate: string, holidays: HolidaySet): boolean {
  return businessDaysBetween(assignedOn, firstInputDate, holidays) < FAST_START_BUSINESS_DAYS;
}

/* ------------------------------ US federal holidays ------------------------------ */

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The nth given weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nthWeekday(year: number, month: number, dow: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return iso(year, month, 1 + ((dow - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, lastDate)).getUTCDay();
  return iso(year, month, lastDate - ((last - dow + 7) % 7));
}

/** Fixed-date holidays move to Friday when on Saturday and to Monday when on Sunday. */
function observed(date: string): { date: string; shifted: boolean } {
  const day = weekday(date);
  if (day === 6) return { date: addDays(date, -1), shifted: true };
  if (day === 0) return { date: addDays(date, 1), shifted: true };
  return { date, shifted: false };
}

/** The eleven US federal holidays for a year, on the days offices observe them. */
export function usFederalHolidays(year: number): { date: string; name: string }[] {
  const fixed = (m: number, d: number, name: string) => {
    const o = observed(iso(year, m, d));
    return { date: o.date, name: o.shifted ? `${name} (observed)` : name };
  };
  return [
    fixed(1, 1, "New Year's Day"),
    { date: nthWeekday(year, 1, 1, 3), name: "Martin Luther King Jr. Day" },
    { date: nthWeekday(year, 2, 1, 3), name: "Presidents' Day" },
    { date: nthWeekday(year, 5, 1, -1), name: "Memorial Day" },
    fixed(6, 19, "Juneteenth"),
    fixed(7, 4, "Independence Day"),
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day" },
    { date: nthWeekday(year, 10, 1, 2), name: "Columbus Day" },
    fixed(11, 11, "Veterans Day"),
    { date: nthWeekday(year, 11, 4, 4), name: "Thanksgiving Day" },
    fixed(12, 25, "Christmas Day"),
  ];
}
