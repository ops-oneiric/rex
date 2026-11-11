import { describe, expect, it } from "vitest";
import {
  associateLoad,
  clientNeeds,
  DEFAULT_RULES,
  evaluateCandidate,
  loadBand,
  offsetMinutes,
  rankCandidates,
  type RuleAssociate,
  type RuleClient,
  seatShare,
} from "@/lib/assignments/rules";
import { SEATS_BY_MODEL } from "@/lib/assignments/seats";

const holidays = new Set(["2026-11-26"]);
const ctx = { today: "2026-11-11", holidays, rules: DEFAULT_RULES, teamAssociateIds: [] as number[] };

// First input Tue Dec 8, 2026. Knock-out window: 5 business days before (Dec 1) to 2 after (Dec 10).
const client: RuleClient = {
  id: 1,
  lifecycleStage: "IMPLEMENTATION",
  supportModel: "TRADITIONAL",
  firstInputDate: "2026-12-08",
  benefitsStartDate: null,
  timeZone: "America/Chicago",
  employeeCount: 120,
  controlCount: 1,
  payrollComplexity: 3,
  implementationType: "NEW_LOGO",
  previousVendor: "IN_HOUSE",
  weight: 1,
  isFastStart: false,
  fastStartFrom: "2026-11-11",
};

function associate(overrides: Partial<RuleAssociate> = {}): RuleAssociate {
  return {
    id: 10,
    name: "Jordan",
    isActive: true,
    canPm: true,
    canPayroll: true,
    timeZone: "America/Chicago",
    targetLoad: 8,
    capabilities: { "new logo": 3, "in-house conversions": 2 },
    pto: [],
    held: [],
    history: [],
    ...overrides,
  };
}

describe("seats and shares", () => {
  it("defines seats per support model", () => {
    expect(SEATS_BY_MODEL.HYBRID).toEqual(["HYBRID"]);
    expect(SEATS_BY_MODEL.TRADITIONAL).toEqual(["PM", "PAYROLL_1"]);
    expect(SEATS_BY_MODEL.PM).toEqual(["PM", "PAYROLL_1", "PAYROLL_2"]);
  });
  it("splits weight by seat", () => {
    expect(seatShare("HYBRID", "HYBRID")).toBe(1);
    expect(seatShare("TRADITIONAL", "PM")).toBe(0.4);
    expect(seatShare("TRADITIONAL", "PAYROLL_1")).toBe(0.6);
    expect(seatShare("PM", "PM")).toBe(0.4);
    expect(seatShare("PM", "PAYROLL_2")).toBe(0.3);
  });
  it("bands loads", () => {
    expect(loadBand(4.9)).toBe("AVAILABLE");
    expect(loadBand(5)).toBe("HEALTHY");
    expect(loadBand(8)).toBe("HEALTHY");
    expect(loadBand(8.1)).toBe("FULL");
    expect(loadBand(10.5)).toBe("OVER");
  });
});

describe("associateLoad", () => {
  it("counts implementations as actual load and prospect holds as projected only", () => {
    const load = associateLoad([
      { clientId: 2, label: "A", seat: "HYBRID", stage: "IMPLEMENTATION", supportModel: "HYBRID", firstInputDate: null, weight: 1.2 },
      { clientId: 3, label: "B", seat: "PM", stage: "IMPLEMENTATION", supportModel: "TRADITIONAL", firstInputDate: null, weight: 1 },
      { clientId: 4, label: "C", seat: "PAYROLL_1", stage: "PROSPECT", supportModel: "TRADITIONAL", firstInputDate: null, weight: 1 },
      { clientId: 5, label: "D", seat: "HYBRID", stage: "SERVICE", supportModel: "HYBRID", firstInputDate: null, weight: 9 },
    ]);
    expect(load).toEqual({ actual: 1.6, projected: 2.2, accounts: 2, holds: 1 });
  });
});

describe("PTO rules", () => {
  it("knocks out payroll and hybrid seats for PTO in the window", () => {
    const a = associate({ pto: [{ startDate: "2026-12-01", endDate: "2026-12-01", isPartialDay: false }] });
    expect(evaluateCandidate(client, "PAYROLL_1", a, ctx).status).toBe("knocked_out");
    expect(evaluateCandidate({ ...client, supportModel: "HYBRID" }, "HYBRID", a, ctx).status).toBe("knocked_out");
  });

  it("only penalizes the PM seat", () => {
    const a = associate({ pto: [{ startDate: "2026-12-09", endDate: "2026-12-10", isPartialDay: false }] });
    const e = evaluateCandidate(client, "PM", a, ctx);
    expect(e.status).toBe("eligible");
    expect(e.flags.some((f) => f.level === "red" && f.text.startsWith("PTO near first input"))).toBe(true);
    expect(e.score).toBeLessThan(evaluateCandidate(client, "PM", associate(), ctx).score - 30);
  });

  it("ignores PTO just outside the window", () => {
    // Nov 30 is 6 business days before Dec 8 (Thanksgiving is a holiday); Dec 11 is 3 after.
    const a = associate({
      pto: [
        { startDate: "2026-11-30", endDate: "2026-11-30", isPartialDay: false },
        { startDate: "2026-12-11", endDate: "2026-12-11", isPartialDay: false },
      ],
    });
    expect(evaluateCandidate(client, "PAYROLL_1", a, ctx).status).toBe("eligible");
  });

  it("flags PTO before first input on a fast start", () => {
    const fast = { ...client, isFastStart: true };
    const a = associate({ pto: [{ startDate: "2026-11-20", endDate: "2026-11-20", isPartialDay: false }] });
    const e = evaluateCandidate(fast, "PAYROLL_1", a, ctx);
    expect(e.status).toBe("eligible");
    expect(e.flags.map((f) => f.text).join()).toMatch(/Fast start with PTO/);
    expect(evaluateCandidate(client, "PAYROLL_1", a, ctx).flags.map((f) => f.text).join()).not.toMatch(/Fast start/);
  });

  it("flags PTO near benefits start", () => {
    const withBenefits = { ...client, benefitsStartDate: "2027-01-04" };
    const a = associate({ pto: [{ startDate: "2026-12-31", endDate: "2026-12-31", isPartialDay: false }] });
    expect(evaluateCandidate(withBenefits, "PM", a, ctx).flags.some((f) => f.text.startsWith("PTO near benefits"))).toBe(true);
  });
});

describe("first input collisions", () => {
  const held = (firstInputDate: string, clientId = 9) => ({
    clientId,
    label: `C${clientId}`,
    seat: "PAYROLL_1" as const,
    stage: "IMPLEMENTATION" as const,
    supportModel: "TRADITIONAL" as const,
    firstInputDate,
    weight: 1,
  });

  it("marks conflicts within 5 business days and close ones within 10", () => {
    const e = evaluateCandidate(client, "PAYROLL_1", associate({ held: [held("2026-12-14", 8), held("2026-12-21", 9), held("2027-02-01", 7)] }), ctx);
    expect(e.collisions.map((c) => [c.label, c.level, c.businessDaysApart])).toEqual([
      ["C8", "conflict", 4],
      ["C9", "close", 9],
    ]);
    expect(e.flags.filter((f) => f.level === "red")).toHaveLength(1);
  });
});

describe("capacity, fit, time zone and ranking", () => {
  it("projects load with this seat's share and flags over-capacity", () => {
    const heavy = associate({
      held: [{ clientId: 2, label: "A", seat: "HYBRID", stage: "IMPLEMENTATION", supportModel: "HYBRID", firstInputDate: null, weight: 10 }],
    });
    const e = evaluateCandidate({ ...client, weight: 1.5 }, "PAYROLL_1", heavy, ctx);
    expect(e.loadAfter).toBe(10.9);
    expect(e.bandAfter).toBe("OVER");
    expect(e.flags.some((f) => f.text.startsWith("Would be over capacity"))).toBe(true);
  });

  it("derives needs and scores fit", () => {
    expect(clientNeeds({ ...client, controlCount: 3, employeeCount: 600, payrollComplexity: 5 }, holidays)).toEqual([
      "New Logo",
      "Multi-Control",
      "Large Employer (500+)",
      "Complex Payroll",
      "In-house Conversions",
    ]);
    const e = evaluateCandidate(client, "PM", associate(), ctx);
    expect(e.needs).toEqual([
      { name: "New Logo", level: 3 },
      { name: "In-house Conversions", level: 2 },
    ]);
    expect(e.fit).toBeCloseTo(5 / 6);
  });

  it("measures time zone distance on the first input date", () => {
    expect(offsetMinutes("America/Chicago", "2026-12-08")).toBe(-360);
    expect(offsetMinutes("America/Chicago", "2026-07-01")).toBe(-300);
    const e = evaluateCandidate(client, "PM", associate({ timeZone: "America/Los_Angeles" }), ctx);
    expect(e.timeZoneHours).toBe(2);
    const far = evaluateCandidate(client, "PM", associate({ timeZone: "Pacific/Honolulu" }), ctx);
    expect(far.flags.some((f) => f.text.includes("hours from the client"))).toBe(true);
  });

  it("marks ineligible associates and ranks eligible ones first", () => {
    const pmOnly = associate({ id: 1, name: "PM only", canPayroll: false });
    const inactive = associate({ id: 2, name: "Inactive", isActive: false });
    const onTeam = associate({ id: 3, name: "On team" });
    const out = associate({ id: 4, name: "Out", pto: [{ startDate: "2026-12-08", endDate: "2026-12-08", isPartialDay: true }] });
    const good = associate({ id: 5, name: "Good" });
    const evals = [pmOnly, inactive, onTeam, out, good].map((a) =>
      evaluateCandidate(client, "PAYROLL_1", a, { ...ctx, teamAssociateIds: [3] }),
    );
    expect(rankCandidates(evals).map((e) => [e.name, e.status])).toEqual([
      ["Good", "eligible"],
      ["Out", "knocked_out"],
      ["Inactive", "ineligible"],
      ["On team", "ineligible"],
      ["PM only", "ineligible"],
    ]);
  });

  it("skips date rules when there is no first input date", () => {
    const a = associate({ pto: [{ startDate: "2026-12-08", endDate: "2026-12-08", isPartialDay: false }] });
    expect(evaluateCandidate({ ...client, firstInputDate: null }, "PAYROLL_1", a, ctx).status).toBe("eligible");
  });
});
