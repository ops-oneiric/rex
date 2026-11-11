/**
 * Pure calculations behind the dashboard and Insights. No database access here, so each
 * one can be unit-tested with plain inputs.
 */
import { addBusinessDays, businessDaysBetween, type HolidaySet } from "@/lib/business-days";
import { addDays, rangesOverlap } from "@/lib/dates";
import type { Stage, SupportModel } from "@/lib/clients/constants";
import { type RuleSettings, seatShare } from "@/lib/assignments/rules";
import { type Seat, seatRole } from "@/lib/assignments/seats";

/* ------------------------------------------ Basics ------------------------------------------ */

/** The Monday on or before an ISO date. */
export function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

/** Mondays from the week containing `from` through the week containing `to`. */
export function weekStarts(from: string, to: string): string[] {
  const out: string[] = [];
  for (let w = mondayOf(from), last = mondayOf(to); w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round(((s[mid - 1]! + s[mid]!) / 2) * 10) / 10;
}

/** Whole-number percentage, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type Bucket = { key: string; label: string; min: number; max: number | null };

/** Counts per bucket, keeping empty buckets so the scale reads the same every time. */
export function countBuckets(values: number[], buckets: Bucket[]): { key: string; label: string; count: number }[] {
  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    count: values.filter((v) => v >= b.min && (b.max === null || v <= b.max)).length,
  }));
}

/* --------------------------------------- PTO conflicts --------------------------------------- */

export type HeldForPto = {
  associateId: number;
  associateName: string;
  clientId: number;
  clientLabel: string;
  seat: Seat;
  firstInputDate: string | null;
  benefitsStartDate: string | null;
};

export type PtoForCheck = { id: number; associateId: number; startDate: string; endDate: string; isPartialDay: boolean };

export type PtoConflict = {
  ptoId: number;
  associateId: number;
  associateName: string;
  clientId: number;
  clientLabel: string;
  role: "PM" | "Payroll" | "Hybrid";
  kind: "FIRST_INPUT" | "BENEFITS";
  /** Red for PTO near first input (a knock-out for payroll and hybrid seats), amber near benefits start. */
  level: "red" | "amber";
  date: string;
  pto: { startDate: string; endDate: string; isPartialDay: boolean };
};

/**
 * PTO that lands near a key date of a client the associate already holds. Uses the same
 * windows as the rules engine, so anything flagged here would have been flagged when
 * assigning. Only upcoming dates and PTO count.
 */
export function ptoConflicts(held: HeldForPto[], pto: PtoForCheck[], ctx: { today: string; holidays: HolidaySet; rules: RuleSettings }): PtoConflict[] {
  const { today, holidays, rules } = ctx;
  const out: PtoConflict[] = [];
  const upcoming = pto.filter((p) => p.endDate >= today);
  for (const h of held) {
    const mine = upcoming.filter((p) => p.associateId === h.associateId);
    if (mine.length === 0) continue;
    const role = seatRole(h.seat);
    const roleLabel = role === "HYBRID" ? "Hybrid" : role === "PM" ? "PM" : "Payroll";
    const base = { associateId: h.associateId, associateName: h.associateName, clientId: h.clientId, clientLabel: h.clientLabel, role: roleLabel } as const;
    const fid = h.firstInputDate;
    if (fid && fid >= today) {
      const start = addBusinessDays(fid, -rules.ptoBefore, holidays);
      const end = addBusinessDays(fid, rules.ptoAfter, holidays);
      for (const p of mine.filter((p) => rangesOverlap(p.startDate, p.endDate, start, end))) {
        out.push({ ...base, ptoId: p.id, kind: "FIRST_INPUT", level: "red", date: fid, pto: p });
      }
    }
    const bsd = h.benefitsStartDate;
    if (bsd && bsd >= today) {
      const start = addBusinessDays(bsd, -rules.benefitsWindow, holidays);
      const end = addBusinessDays(bsd, rules.benefitsWindow, holidays);
      for (const p of mine.filter((p) => rangesOverlap(p.startDate, p.endDate, start, end))) {
        // Already reported against first input for the same PTO and client: keep the stronger one.
        if (out.some((o) => o.ptoId === p.id && o.clientId === h.clientId)) continue;
        out.push({ ...base, ptoId: p.id, kind: "BENEFITS", level: "amber", date: bsd, pto: p });
      }
    }
  }
  return out.sort((a, b) => (a.level === b.level ? a.date.localeCompare(b.date) : a.level === "red" ? -1 : 1));
}

/* ------------------------------------------ Stages ------------------------------------------ */

export type StageEvent = { on: string; to: Stage };

/** The stage a client was in on a date, from its history (oldest first). Null before it existed. */
export function stageOn(history: StageEvent[], date: string): Stage | null {
  let stage: Stage | null = null;
  for (const e of history) {
    if (e.on > date) break;
    stage = e.to;
  }
  return stage;
}

/**
 * Completed implementations: from entering Implementation to moving to Service. A client
 * that went back and forth counts from its last entry into Implementation.
 */
export function implementationSpans(history: StageEvent[]): { start: string; end: string; days: number }[] {
  const spans: { start: string; end: string; days: number }[] = [];
  let start: string | null = null;
  for (const e of history) {
    if (e.to === "IMPLEMENTATION") start = e.on;
    else if (e.to === "SERVICE" && start) {
      spans.push({ start, end: e.on, days: daysBetween(start, e.on) });
      start = null;
    } else if (e.to === "PROSPECT") start = null;
  }
  return spans;
}

/* ------------------------------------------- Load ------------------------------------------- */

export type HistoricAssignment = { associateId: number; clientId: number; seat: Seat; startDate: string; endDate: string | null };

/**
 * Team load on each date: the weighted share of every seat held on an Implementation client
 * that day. Weights are each client's current weight (Rex doesn't keep old weights).
 */
export function loadOnDates(
  dates: string[],
  rows: HistoricAssignment[],
  clients: Map<number, { supportModel: SupportModel | null; weight: number; history: StageEvent[] }>,
  rules: RuleSettings,
): { date: string; load: number; accounts: number }[] {
  return dates.map((date) => {
    let load = 0;
    const accounts = new Set<number>();
    for (const r of rows) {
      if (r.startDate > date || (r.endDate !== null && r.endDate <= date)) continue;
      const c = clients.get(r.clientId);
      if (!c || stageOn(c.history, date) !== "IMPLEMENTATION") continue;
      load += c.weight * seatShare(c.supportModel, r.seat, rules);
      accounts.add(r.clientId);
    }
    return { date, load: Math.round(load * 10) / 10, accounts: accounts.size };
  });
}

/* ---------------------------------------- Lead time ---------------------------------------- */

export const LEAD_TIME_BUCKETS: Bucket[] = [
  { key: "lt10", label: "Under 10 days", min: Number.NEGATIVE_INFINITY, max: 9 },
  { key: "10-19", label: "10 to 19 days", min: 10, max: 19 },
  { key: "20-39", label: "20 to 39 days", min: 20, max: 39 },
  { key: "40-59", label: "40 to 59 days", min: 40, max: 59 },
  { key: "60", label: "60 days or more", min: 60, max: null },
];

/** Business days from assignment to first input. */
export function leadTimes(clients: { assignedOn: string | null; firstInputDate: string | null }[], holidays: HolidaySet): number[] {
  return clients.flatMap((c) => (c.assignedOn && c.firstInputDate ? [businessDaysBetween(c.assignedOn, c.firstInputDate, holidays)] : []));
}

export const DURATION_BUCKETS: Bucket[] = [
  { key: "lt30", label: "Under 30 days", min: Number.NEGATIVE_INFINITY, max: 29 },
  { key: "30-59", label: "30 to 59 days", min: 30, max: 59 },
  { key: "60-89", label: "60 to 89 days", min: 60, max: 89 },
  { key: "90-119", label: "90 to 119 days", min: 90, max: 119 },
  { key: "120", label: "120 days or more", min: 120, max: null },
];
