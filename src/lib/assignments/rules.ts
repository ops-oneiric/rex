/**
 * The assignment rules engine (plan Section 4.5). Pure functions: given a client, a seat
 * and the facts about each associate, it works out knock-outs, flags, load and a score.
 * Claude (Phase 4) receives these facts; it never does this arithmetic itself.
 */
import { z } from "zod";
import { addBusinessDays, businessDaysBetween, type HolidaySet } from "@/lib/business-days";
import type { ImplementationType, PreviousVendor, Stage, SupportModel } from "@/lib/clients/constants";
import { formatDateRange, rangesOverlap } from "@/lib/dates";
import { canFill, isPayrollRole, type Seat, seatRole, type SeatRole } from "./seats";

/* --------------------------------------- Settings --------------------------------------- */

const n = (max: number) => z.number().min(0).max(max);

export const ruleSettingsSchema = z.object({
  /** PTO knock-out window around first input, in business days. */
  ptoBefore: n(30).int(),
  ptoAfter: n(30).int(),
  /** PTO within this many business days of benefits start is flagged. */
  benefitsWindow: n(30).int(),
  /** First inputs this close (business days) are a conflict / close. */
  collisionConflict: n(30).int(),
  collisionClose: n(60).int(),
  /** Share of a client's weight carried by each seat. */
  shareTraditionalPm: n(1),
  shareTraditionalPayroll: n(1),
  sharePmModelPm: n(1),
  sharePmModelPayroll: n(1),
  /** Load bands: below `healthy` is Available, up to `full` Healthy, up to `over` Full, above Over. */
  bandHealthy: n(30),
  bandFull: n(30),
  bandOver: n(30),
  /** Flag time zones this many hours apart or more. */
  timeZoneFlagHours: n(12).int(),
});

export type RuleSettings = z.infer<typeof ruleSettingsSchema>;

export const DEFAULT_RULES: RuleSettings = {
  ptoBefore: 5,
  ptoAfter: 2,
  benefitsWindow: 3,
  collisionConflict: 5,
  collisionClose: 10,
  shareTraditionalPm: 0.4,
  shareTraditionalPayroll: 0.6,
  sharePmModelPm: 0.4,
  sharePmModelPayroll: 0.3,
  bandHealthy: 5,
  bandFull: 8,
  bandOver: 10,
  timeZoneFlagHours: 3,
};

/** Fraction of a client's weight that a seat carries. */
export function seatShare(model: SupportModel | null, seat: Seat, r: RuleSettings = DEFAULT_RULES): number {
  if (model === "HYBRID" || seat === "HYBRID") return 1;
  if (model === "TRADITIONAL") return seat === "PM" ? r.shareTraditionalPm : r.shareTraditionalPayroll;
  if (model === "PM") return seat === "PM" ? r.sharePmModelPm : r.sharePmModelPayroll;
  return 1;
}

export type Band = "AVAILABLE" | "HEALTHY" | "FULL" | "OVER";
export const BAND_LABELS: Record<Band, string> = {
  AVAILABLE: "Available",
  HEALTHY: "Healthy",
  FULL: "Full",
  OVER: "Over capacity",
};

export function loadBand(load: number, r: RuleSettings = DEFAULT_RULES): Band {
  if (load > r.bandOver) return "OVER";
  if (load > r.bandFull) return "FULL";
  if (load >= r.bandHealthy) return "HEALTHY";
  return "AVAILABLE";
}

/* ----------------------------------------- Inputs ----------------------------------------- */

export type RuleClient = {
  id: number;
  lifecycleStage: Stage;
  supportModel: SupportModel | null;
  firstInputDate: string | null;
  benefitsStartDate: string | null;
  timeZone: string | null;
  employeeCount: number | null;
  controlCount: number | null;
  payrollComplexity: number | null;
  implementationType: ImplementationType | null;
  previousVendor: PreviousVendor | null;
  /** Workload weight (from deriveClient). */
  weight: number;
  isFastStart: boolean;
  /** Start of the fast-start PTO window: the assignment date, or today if unassigned. */
  fastStartFrom: string;
};

/** One of the associate's current assignments (not ended). */
export type HeldSeat = {
  clientId: number;
  label: string;
  seat: Seat;
  stage: Stage;
  supportModel: SupportModel | null;
  firstInputDate: string | null;
  weight: number;
};

export type RuleAssociate = {
  id: number;
  name: string;
  isActive: boolean;
  canPm: boolean;
  canPayroll: boolean;
  timeZone: string;
  targetLoad: number;
  /** Capability name (lowercase) -> level 1-3. */
  capabilities: Record<string, number>;
  pto: { startDate: string; endDate: string; isPartialDay: boolean }[];
  held: HeldSeat[];
  /** Past and current accounts, for experience. */
  history: { implementationType: ImplementationType | null; previousVendor: PreviousVendor | null }[];
};

/* ------------------------------------------ Load ------------------------------------------ */

export type Load = { actual: number; projected: number; accounts: number; holds: number };

/** Actual load counts Implementation clients; projected adds holds on prospects. */
export function associateLoad(held: HeldSeat[], r: RuleSettings = DEFAULT_RULES): Load {
  let actual = 0;
  let projected = 0;
  let accounts = 0;
  let holds = 0;
  for (const h of held) {
    const share = h.weight * seatShare(h.supportModel, h.seat, r);
    if (h.stage === "IMPLEMENTATION") {
      actual += share;
      accounts += 1;
    } else if (h.stage === "PROSPECT") {
      holds += 1;
    } else continue;
    projected += share;
  }
  const round = (x: number) => Math.round(x * 100) / 100;
  return { actual: round(actual), projected: round(projected), accounts, holds };
}

/* ------------------------------------------ Needs ------------------------------------------ */

/**
 * Capabilities a client calls for, by the starter capability names. Renamed capabilities
 * are not matched here; Claude still reads every capability and note in Phase 4.
 */
export function clientNeeds(c: RuleClient, holidays: HolidaySet): string[] {
  const needs: string[] = [];
  if (c.implementationType === "NEW_LOGO") needs.push("New Logo");
  if (c.implementationType === "ADD_CONTROL") needs.push("Add Control");
  if ((c.controlCount ?? 1) > 1) needs.push("Multi-Control");
  if ((c.employeeCount ?? 0) >= 500) needs.push("Large Employer (500+)");
  if ((c.payrollComplexity ?? 0) >= 4) needs.push("Complex Payroll");
  if (c.previousVendor === "IN_HOUSE") needs.push("In-house Conversions");
  if (
    c.firstInputDate &&
    c.benefitsStartDate &&
    Math.abs(businessDaysBetween(c.firstInputDate, c.benefitsStartDate, holidays)) <= 10
  ) {
    needs.push("Benefits-heavy");
  }
  return needs;
}

/* ------------------------------------- Time zone offset ------------------------------------ */

/** UTC offset in minutes for a zone on a given date (noon UTC avoids DST edge hours). */
export function offsetMinutes(timeZone: string, isoDate: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(
    new Date(`${isoDate}T12:00:00Z`),
  );
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

/* --------------------------------------- Evaluation --------------------------------------- */

export type Flag = { level: "red" | "amber"; text: string };

export type Collision = { clientId: number; label: string; firstInputDate: string; businessDaysApart: number; level: "conflict" | "close" };

export type Evaluation = {
  associateId: number;
  name: string;
  status: "eligible" | "knocked_out" | "ineligible";
  /** Why the associate is knocked out or ineligible. */
  reasons: string[];
  flags: Flag[];
  collisions: Collision[];
  load: Load;
  /** Projected load if this seat is added. */
  loadAfter: number;
  bandAfter: Band;
  targetLoad: number;
  needs: { name: string; level: number }[];
  /** 0-1: how well capability levels cover the client's needs (1 if there are none). */
  fit: number;
  timeZoneHours: number | null;
  experience: number;
  /** 0-100 ranking score; higher is better. */
  score: number;
};

export type EvaluationContext = {
  today: string;
  holidays: HolidaySet;
  rules: RuleSettings;
  /** Associates already on this client's team (other seats). */
  teamAssociateIds: number[];
};

export function evaluateCandidate(
  client: RuleClient,
  seat: Seat,
  a: RuleAssociate,
  ctx: EvaluationContext,
): Evaluation {
  const { holidays, rules } = ctx;
  const role: SeatRole = seatRole(seat);
  const reasons: string[] = [];
  const flags: Flag[] = [];
  let penalty = 0;

  if (!a.isActive) reasons.push("Inactive");
  if (!canFill(role, a)) {
    reasons.push(role === "HYBRID" ? "Not eligible for Hybrid (needs PM and payroll)" : `Not eligible for ${role === "PM" ? "PM" : "payroll"} seats`);
  }
  if (ctx.teamAssociateIds.includes(a.id)) reasons.push("Already on this team in another seat");
  const ineligible = reasons.length > 0;
  let knockedOut = false;

  const fid = client.firstInputDate;
  const ptoText = (p: { startDate: string; endDate: string; isPartialDay: boolean }) =>
    `${formatDateRange(p.startDate, p.endDate)}${p.isPartialDay ? " (partial day)" : ""}`;

  if (fid) {
    // 1. PTO around first input.
    const winStart = addBusinessDays(fid, -rules.ptoBefore, holidays);
    const winEnd = addBusinessDays(fid, rules.ptoAfter, holidays);
    const near = a.pto.filter((p) => rangesOverlap(p.startDate, p.endDate, winStart, winEnd));
    if (near.length) {
      const text = `PTO near first input: ${near.map(ptoText).join(", ")}`;
      if (isPayrollRole(role)) {
        knockedOut = true;
        reasons.push(text);
      } else {
        flags.push({ level: "red", text });
        penalty += 35;
      }
    }

    // Fast start: any PTO between assignment and first input (payroll and hybrid seats).
    if (client.isFastStart && isPayrollRole(role) && !knockedOut) {
      const runway = a.pto.filter((p) => rangesOverlap(p.startDate, p.endDate, client.fastStartFrom, fid));
      if (runway.length) {
        flags.push({ level: "red", text: `Fast start with PTO before first input: ${runway.map(ptoText).join(", ")}` });
        penalty += 30;
      }
    }

    // PTO around benefits start.
    if (client.benefitsStartDate) {
      const bStart = addBusinessDays(client.benefitsStartDate, -rules.benefitsWindow, holidays);
      const bEnd = addBusinessDays(client.benefitsStartDate, rules.benefitsWindow, holidays);
      const nearBenefits = a.pto.filter((p) => rangesOverlap(p.startDate, p.endDate, bStart, bEnd));
      if (nearBenefits.length) {
        flags.push({ level: "amber", text: `PTO near benefits start: ${nearBenefits.map(ptoText).join(", ")}` });
        penalty += 15;
      }
    }
  }

  // 2. First input collisions with the associate's other clients.
  const collisions: Collision[] = [];
  if (fid) {
    for (const h of a.held) {
      if (h.clientId === client.id || !h.firstInputDate || h.stage === "SERVICE") continue;
      const apart = Math.abs(businessDaysBetween(fid, h.firstInputDate, holidays));
      if (apart <= rules.collisionConflict) {
        collisions.push({ clientId: h.clientId, label: h.label, firstInputDate: h.firstInputDate, businessDaysApart: apart, level: "conflict" });
      } else if (apart <= rules.collisionClose) {
        collisions.push({ clientId: h.clientId, label: h.label, firstInputDate: h.firstInputDate, businessDaysApart: apart, level: "close" });
      }
    }
  }
  const conflicts = collisions.filter((c) => c.level === "conflict");
  const close = collisions.filter((c) => c.level === "close");
  if (conflicts.length) {
    flags.push({ level: "red", text: `First input within ${rules.collisionConflict} business days of ${conflicts.map((c) => c.label).join(", ")}` });
    penalty += Math.min(conflicts.length * 25, 50);
  }
  if (close.length) {
    flags.push({ level: "amber", text: `First input within ${rules.collisionClose} business days of ${close.map((c) => c.label).join(", ")}` });
    penalty += Math.min(close.length * 10, 20);
  }

  // 3. Capacity.
  const load = associateLoad(a.held.filter((h) => h.clientId !== client.id), rules);
  const added = client.weight * seatShare(client.supportModel, seat, rules);
  const loadAfter = Math.round((load.projected + added) * 100) / 100;
  const bandAfter = loadBand(loadAfter, rules);
  if (loadAfter > rules.bandFull) penalty += (Math.min(loadAfter, rules.bandOver) - rules.bandFull) * 8;
  if (loadAfter > rules.bandOver) {
    penalty += (loadAfter - rules.bandOver) * 15;
    flags.push({ level: "red", text: `Would be over capacity (${loadAfter.toFixed(1)})` });
  } else if (loadAfter > a.targetLoad) {
    flags.push({ level: "amber", text: `Above personal target of ${a.targetLoad} (${loadAfter.toFixed(1)})` });
  }

  // 4. Capability fit.
  const needs = clientNeeds(client, holidays).map((name) => ({ name, level: a.capabilities[name.toLowerCase()] ?? 0 }));
  const fit = needs.length ? needs.reduce((s, x) => s + x.level, 0) / (needs.length * 3) : 1;
  const gaps = needs.filter((x) => x.level === 0).map((x) => x.name);
  if (gaps.length) flags.push({ level: "amber", text: `No rating for: ${gaps.join(", ")}` });

  // 5. Time zone.
  let timeZoneHours: number | null = null;
  if (client.timeZone) {
    const on = fid ?? ctx.today;
    timeZoneHours = Math.round((Math.abs(offsetMinutes(a.timeZone, on) - offsetMinutes(client.timeZone, on)) / 60) * 10) / 10;
    if (timeZoneHours >= rules.timeZoneFlagHours) flags.push({ level: "amber", text: `${timeZoneHours} hours from the client's time zone` });
    penalty += timeZoneHours * 2;
  }

  // 6. Experience with this kind of account.
  const experience = a.history.filter(
    (h) => h.implementationType === client.implementationType && h.previousVendor === client.previousVendor,
  ).length;

  const score = Math.max(0, Math.min(100, Math.round(85 - penalty + fit * 15 + Math.min(experience, 5))));

  return {
    associateId: a.id,
    name: a.name,
    status: ineligible ? "ineligible" : knockedOut ? "knocked_out" : "eligible",
    reasons,
    flags,
    collisions,
    load,
    loadAfter,
    bandAfter,
    targetLoad: a.targetLoad,
    needs,
    fit,
    timeZoneHours,
    experience,
    score,
  };
}

/** Ranks candidates: eligible by score, then knocked out, then ineligible. */
export function rankCandidates(evals: Evaluation[]): Evaluation[] {
  const order = { eligible: 0, knocked_out: 1, ineligible: 2 } as const;
  return [...evals].sort((x, y) => order[x.status] - order[y.status] || y.score - x.score || x.name.localeCompare(y.name));
}
