import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/assignments/rules";
import {
  countBuckets,
  DURATION_BUCKETS,
  implementationSpans,
  leadTimes,
  loadOnDates,
  median,
  mondayOf,
  percent,
  ptoConflicts,
  stageOn,
  weekStarts,
  type HeldForPto,
  type StageEvent,
} from "@/lib/insights/metrics";
import { rankMatches } from "@/lib/search-match";

const noHolidays = new Set<string>();

describe("basics", () => {
  it("finds Mondays and week starts", () => {
    expect(mondayOf("2026-11-11")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(weekStarts("2026-11-11", "2026-11-24")).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
  });

  it("computes medians and percentages", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percent(1, 3)).toBe(33);
    expect(percent(1, 0)).toBeNull();
  });

  it("keeps empty buckets", () => {
    const out = countBuckets([10, 45, 45, 200], DURATION_BUCKETS);
    expect(out.map((b) => b.count)).toEqual([1, 2, 0, 0, 1]);
  });
});

describe("PTO conflicts", () => {
  const today = "2026-11-11";
  const held = (seat: HeldForPto["seat"], extra: Partial<HeldForPto> = {}): HeldForPto => ({
    associateId: 1,
    associateName: "Sam Patel",
    clientId: 7,
    clientLabel: "HLX · Helix Labs",
    seat,
    firstInputDate: "2026-11-20",
    benefitsStartDate: null,
    ...extra,
  });
  const ctx = { today, holidays: noHolidays, rules: DEFAULT_RULES };
  const pto = (id: number, startDate: string, endDate = startDate) => ({ id, associateId: 1, startDate, endDate, isPartialDay: false });

  it("flags PTO in the first input window, for payroll and PM seats", () => {
    // Nov 20 is a Friday; 5 business days before is Nov 13.
    const near = pto(1, "2026-11-16", "2026-11-17");
    expect(ptoConflicts([held("PAYROLL_1")], [near], ctx)).toMatchObject([{ kind: "FIRST_INPUT", level: "red", role: "Payroll", ptoId: 1 }]);
    expect(ptoConflicts([held("PM")], [near], ctx)).toMatchObject([{ role: "PM", level: "red" }]);
    expect(ptoConflicts([held("HYBRID")], [near], ctx)).toMatchObject([{ role: "Hybrid" }]);
  });

  it("ignores PTO outside the window, PTO already taken and other people's PTO", () => {
    expect(ptoConflicts([held("PAYROLL_1")], [pto(1, "2026-12-07")], ctx)).toEqual([]);
    expect(ptoConflicts([held("PAYROLL_1", { firstInputDate: "2026-11-12" })], [pto(1, "2026-11-09", "2026-11-10")], ctx)).toEqual([]);
    expect(ptoConflicts([held("PAYROLL_1")], [{ ...pto(1, "2026-11-18"), associateId: 2 }], ctx)).toEqual([]);
    expect(ptoConflicts([held("PAYROLL_1", { firstInputDate: "2026-11-01" })], [pto(1, "2026-11-12")], ctx)).toEqual([]);
  });

  it("flags benefits start in amber, unless the same PTO already conflicts with first input", () => {
    const benefits = held("PM", { firstInputDate: "2026-12-14", benefitsStartDate: "2026-12-01" });
    expect(ptoConflicts([benefits], [pto(1, "2026-12-02")], ctx)).toMatchObject([{ kind: "BENEFITS", level: "amber", date: "2026-12-01" }]);
    const both = held("PAYROLL_1", { benefitsStartDate: "2026-11-23" });
    expect(ptoConflicts([both], [pto(1, "2026-11-19")], ctx)).toMatchObject([{ kind: "FIRST_INPUT" }]);
  });

  it("lists red conflicts first, then by date", () => {
    const a = held("PM", { clientId: 8, firstInputDate: "2026-12-18", benefitsStartDate: "2026-11-25" });
    const b = held("PAYROLL_1", { clientId: 9, firstInputDate: "2026-12-04" });
    const out = ptoConflicts([a, b], [pto(1, "2026-11-24"), pto(2, "2026-12-03")], ctx);
    expect(out.map((c) => [c.clientId, c.level])).toEqual([
      [9, "red"],
      [8, "amber"],
    ]);
  });
});

describe("stages, durations and load", () => {
  const history: StageEvent[] = [
    { on: "2026-01-05", to: "PROSPECT" },
    { on: "2026-02-02", to: "IMPLEMENTATION" },
    { on: "2026-04-02", to: "SERVICE" },
  ];

  it("knows the stage on a date", () => {
    expect(stageOn(history, "2026-01-01")).toBeNull();
    expect(stageOn(history, "2026-01-05")).toBe("PROSPECT");
    expect(stageOn(history, "2026-03-01")).toBe("IMPLEMENTATION");
    expect(stageOn(history, "2026-05-01")).toBe("SERVICE");
  });

  it("measures completed implementations from the last entry into Implementation", () => {
    expect(implementationSpans(history)).toEqual([{ start: "2026-02-02", end: "2026-04-02", days: 59 }]);
    const restarted: StageEvent[] = [
      { on: "2026-01-05", to: "IMPLEMENTATION" },
      { on: "2026-01-20", to: "PROSPECT" },
      { on: "2026-03-02", to: "IMPLEMENTATION" },
      { on: "2026-04-01", to: "SERVICE" },
    ];
    expect(implementationSpans(restarted)).toEqual([{ start: "2026-03-02", end: "2026-04-01", days: 30 }]);
    expect(implementationSpans([{ on: "2026-01-05", to: "IMPLEMENTATION" }])).toEqual([]);
  });

  it("sums weighted seat shares held on Implementation clients", () => {
    const clients = new Map([[1, { supportModel: "TRADITIONAL" as const, weight: 2, history }]]);
    const rows = [
      { associateId: 1, clientId: 1, seat: "PAYROLL_1" as const, startDate: "2026-02-10", endDate: null },
      { associateId: 2, clientId: 1, seat: "PM" as const, startDate: "2026-02-10", endDate: "2026-03-02" },
    ];
    const out = loadOnDates(["2026-02-01", "2026-02-16", "2026-03-02", "2026-04-06"], rows, clients, DEFAULT_RULES);
    expect(out.map((p) => p.load)).toEqual([0, 2, 1.2, 0]);
    expect(out.map((p) => p.accounts)).toEqual([0, 1, 1, 0]);
  });

  it("measures runway in business days", () => {
    expect(
      leadTimes(
        [
          { assignedOn: "2026-11-02", firstInputDate: "2026-11-16" },
          { assignedOn: null, firstInputDate: "2026-11-16" },
        ],
        noHolidays,
      ),
    ).toEqual([10]);
  });
});

describe("command palette matching", () => {
  const items = [
    { label: "ACM · Acme Manufacturing", keywords: "ACM Acme Manufacturing", detail: "Implementation" },
    { label: "MAC · Macro Ltd", keywords: "MAC Macro Ltd", detail: "Prospect" },
    { label: "BLV · Bellview Dental", keywords: "BLV Bellview Dental", detail: "Service" },
    { label: "Sam Patel", keywords: "Sam Patel payroll lead" },
  ];

  it("puts an exact company code first", () => {
    expect(rankMatches(items, "mac").map((i) => i.label)).toEqual(["MAC · Macro Ltd"]);
    expect(rankMatches(items, "acm")[0]!.label).toBe("ACM · Acme Manufacturing");
  });

  it("needs every word and searches keywords and details", () => {
    expect(rankMatches(items, "pat sam").map((i) => i.label)).toEqual(["Sam Patel"]);
    expect(rankMatches(items, "payroll").map((i) => i.label)).toEqual(["Sam Patel"]);
    expect(rankMatches(items, "service").map((i) => i.label)).toEqual(["BLV · Bellview Dental"]);
    expect(rankMatches(items, "zzz")).toEqual([]);
  });

  it("returns the first items for an empty query, up to the limit", () => {
    expect(rankMatches(items, "  ", 2)).toHaveLength(2);
  });
});
