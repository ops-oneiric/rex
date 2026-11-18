/** Month-grid helpers for the dashboard calendar. Pure, so they run in the browser and in tests. */
import { addDays } from "@/lib/dates";

/** "2026-11" for an ISO date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function lastDayOf(month: string): string {
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

/**
 * The weeks shown for a month, Sunday first (US calendars), padded with the neighbouring
 * months' days so every week has seven.
 */
export function monthWeeks(month: string): { date: string; inMonth: boolean }[][] {
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
  const start = addDays(first, -dow(first));
  const end = addDays(last, 6 - dow(last));
  const weeks: { date: string; inMonth: boolean }[][] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (dow(d) === 0) weeks.push([]);
    weeks.at(-1)!.push({ date: d, inMonth: monthOf(d) === month });
  }
  return weeks;
}

/** Every date from start to end, inclusive. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "Sam P." for a chip; the full name shows in the day details. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0]!;
}
