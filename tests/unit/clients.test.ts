import { describe, expect, it } from "vitest";
import { allowedTransitions, clientSchema, missingForStage } from "@/lib/clients/validation";
import { computeWeight, DEFAULT_WEIGHTS } from "@/lib/clients/weight";
import { fieldErrors } from "@/lib/forms";

const full = {
  companyCode: " abc ",
  displayName: "",
  lifecycleStage: "IMPLEMENTATION",
  implementationType: "NEW_LOGO",
  supportModel: "TRADITIONAL",
  employeeCount: "120",
  firstInputDate: "2027-01-08",
  benefitsStartDate: "",
  timeZone: "America/Chicago",
  controlCount: "1",
  payrollComplexity: "3",
  previousVendor: "IN_HOUSE",
  notes: "",
};

describe("clientSchema", () => {
  it("normalizes a complete implementation client", () => {
    const c = clientSchema.parse(full);
    expect(c).toMatchObject({ companyCode: "ABC", displayName: null, employeeCount: 120, benefitsStartDate: null });
  });

  it("lets prospects leave fields blank but needs a code or name", () => {
    const blank = Object.fromEntries(Object.keys(full).map((k) => [k, ""]));
    expect(clientSchema.safeParse({ ...blank, lifecycleStage: "PROSPECT", displayName: "Acme Co" }).success).toBe(true);
    const r = clientSchema.safeParse({ ...blank, lifecycleStage: "PROSPECT" });
    expect(fieldErrors(r.error!).companyCode).toMatch(/company code or a name/);
  });

  it("requires every field for implementation", () => {
    const r = clientSchema.safeParse({ ...full, supportModel: "", firstInputDate: "" });
    const errors = fieldErrors(r.error!);
    expect(errors.supportModel).toMatch(/required for Implementation/);
    expect(errors.firstInputDate).toMatch(/required/);
  });

  it("validates company codes", () => {
    expect(fieldErrors(clientSchema.safeParse({ ...full, companyCode: "AB" }).error!).companyCode).toMatch(/exactly 3/);
    expect(clientSchema.safeParse({ ...full, companyCode: "A-1" }).success).toBe(false);
    expect(clientSchema.parse({ ...full, companyCode: "x9z" }).companyCode).toBe("X9Z");
  });

  it("validates numbers", () => {
    expect(clientSchema.safeParse({ ...full, payrollComplexity: "6" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...full, employeeCount: "12.5" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...full, controlCount: "0" }).success).toBe(false);
  });
});

describe("lifecycle", () => {
  it("moves one stage at a time", () => {
    expect(allowedTransitions("PROSPECT")).toEqual(["IMPLEMENTATION"]);
    expect(allowedTransitions("IMPLEMENTATION")).toEqual(["PROSPECT", "SERVICE"]);
    expect(allowedTransitions("SERVICE")).toEqual(["IMPLEMENTATION"]);
  });
  it("lists missing fields for later stages only", () => {
    expect(missingForStage({}, "PROSPECT")).toEqual([]);
    expect(missingForStage({ companyCode: "ABC" }, "IMPLEMENTATION").map(([f]) => f)).not.toContain("companyCode");
    expect(missingForStage({}, "SERVICE")).toHaveLength(9);
  });
});

describe("computeWeight", () => {
  const typical = {
    employeeCount: 120,
    controlCount: 1,
    payrollComplexity: 3,
    implementationType: "NEW_LOGO" as const,
    previousVendor: "IN_HOUSE" as const,
  };

  it("matches the plan's worked example (1.1)", () => {
    const w = computeWeight(typical, false);
    expect(w.total).toBe(1.1);
    expect(w.incomplete).toBe(false);
  });

  it("adds fast start, large employers and extra controls (capped)", () => {
    expect(computeWeight(typical, true).total).toBe(1.3);
    expect(computeWeight({ ...typical, employeeCount: 800 }, false).total).toBe(1.5);
    expect(computeWeight({ ...typical, controlCount: 3 }, false).total).toBe(1.3);
    expect(computeWeight({ ...typical, controlCount: 40 }, false).total).toBe(1.6);
  });

  it("treats missing inputs as zero and flags the total as incomplete", () => {
    const w = computeWeight(
      { employeeCount: null, controlCount: null, payrollComplexity: null, implementationType: null, previousVendor: null },
      false,
    );
    expect(w.total).toBe(DEFAULT_WEIGHTS.base);
    expect(w.incomplete).toBe(true);
  });

  it("uses custom settings", () => {
    expect(computeWeight(typical, false, { ...DEFAULT_WEIGHTS, base: 1, newLogo: 0.5 }).total).toBe(1.9);
  });
});

describe("deriveClient", () => {
  // Imported lazily to keep the top of the file focused on validation.
  const base = {
    lifecycleStage: "IMPLEMENTATION" as const,
    firstInputDate: "2026-12-07",
    benefitsStartDate: "2027-01-01",
    assignedOn: null,
    employeeCount: 120,
    controlCount: 1,
    payrollComplexity: 3,
    implementationType: "NEW_LOGO" as const,
    previousVendor: "IN_HOUSE" as const,
  };
  const holidays = new Set(["2026-11-26", "2026-12-25", "2027-01-01"]);

  it("projects a fast start from today when unassigned, and adds its weight", async () => {
    const { deriveClient } = await import("@/lib/clients/derive");
    const d = deriveClient(base, { today: "2026-11-10", holidays, weights: DEFAULT_WEIGHTS });
    expect(d.businessDaysToFirstInput).toBe(18); // Nov 11 - Dec 7, minus Thanksgiving
    expect(d.fastStart).toEqual({ kind: "projected", isFastStart: true });
    expect(d.weight.total).toBe(1.3);
    expect(d.benefitsOffset).toBe(17); // Dec 8 - Jan 1, minus Christmas and New Year's Day
  });

  it("uses the assignment date once assigned", async () => {
    const { deriveClient } = await import("@/lib/clients/derive");
    const d = deriveClient({ ...base, assignedOn: "2026-10-01" }, { today: "2026-11-10", holidays, weights: DEFAULT_WEIGHTS });
    expect(d.fastStart).toEqual({ kind: "fixed", isFastStart: false });
    expect(d.weight.total).toBe(1.1);
  });

  it("has no fast start without a first input date or for unassigned service clients", async () => {
    const { deriveClient } = await import("@/lib/clients/derive");
    const ctx = { today: "2026-11-10", holidays, weights: DEFAULT_WEIGHTS };
    expect(deriveClient({ ...base, firstInputDate: null }, ctx).fastStart).toBeNull();
    expect(deriveClient({ ...base, lifecycleStage: "SERVICE" }, ctx).fastStart).toBeNull();
  });
});
