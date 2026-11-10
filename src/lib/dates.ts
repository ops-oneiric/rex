/**
 * Calendar-date helpers. Rex stores calendar dates as "YYYY-MM-DD" strings so they
 * never shift with time zones; these helpers parse them as UTC midnight.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Number of Monday-Friday days in [start, end], inclusive. Holidays arrive in Phase 2. */
export function countWeekdays(start: string, end: string): number {
  if (end < start) return 0;
  let count = 0;
  for (let t = toUtc(start).getTime(), last = toUtc(end).getTime(); t <= last; t += DAY_MS) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

/** Inclusive ranges overlap when each starts on or before the other ends. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const full = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });

export function formatDate(iso: string, { withWeekday = false } = {}): string {
  const d = toUtc(iso);
  return withWeekday ? `${weekday.format(d)}, ${full.format(d)}` : full.format(d);
}

/** "Nov 10, 2026", "Nov 10 – 14, 2026", "Nov 28 – Dec 2, 2026", "Dec 30, 2026 – Jan 2, 2027". */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const s = toUtc(start);
  const e = toUtc(end);
  if (s.getUTCFullYear() !== e.getUTCFullYear()) return `${full.format(s)} – ${full.format(e)}`;
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${monthDay.format(s)} – ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  return `${monthDay.format(s)} – ${full.format(e)}`;
}
