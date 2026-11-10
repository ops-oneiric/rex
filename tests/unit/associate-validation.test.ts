import { describe, expect, it } from "vitest";
import { associateSchema, capabilitySchema, ptoSchema } from "@/lib/associates/validation";
import { fieldErrors } from "@/lib/forms";

const valid = {
  name: "  Jordan Lee ",
  email: "",
  title: "",
  timeZone: "America/Chicago",
  canPm: false,
  canPayroll: true,
  targetLoad: "8",
  isDirectlyManaged: true,
};

describe("associateSchema", () => {
  it("normalizes a valid associate", () => {
    const result = associateSchema.parse(valid);
    expect(result).toMatchObject({ name: "Jordan Lee", email: null, title: null, targetLoad: 8 });
  });

  it("requires at least one seat", () => {
    const result = associateSchema.safeParse({ ...valid, canPayroll: false });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!).seats).toMatch(/at least one seat/);
  });

  it("validates email, time zone and target load", () => {
    const result = associateSchema.safeParse({
      ...valid,
      email: "not-an-email",
      timeZone: "Mars/Olympus",
      targetLoad: "7.3",
    });
    const errors = fieldErrors(result.error!);
    expect(errors.email).toBeDefined();
    expect(errors.timeZone).toBeDefined();
    expect(errors.targetLoad).toMatch(/half/);
    expect(associateSchema.safeParse({ ...valid, targetLoad: "7.5" }).success).toBe(true);
    expect(associateSchema.safeParse({ ...valid, targetLoad: "16" }).success).toBe(false);
  });
});

describe("ptoSchema", () => {
  const base = { startDate: "2026-12-21", endDate: "2026-12-24", isPartialDay: false, note: "Holidays" };

  it("accepts a normal range", () => {
    expect(ptoSchema.safeParse(base).success).toBe(true);
  });
  it("rejects an end before the start", () => {
    const r = ptoSchema.safeParse({ ...base, endDate: "2026-12-20" });
    expect(fieldErrors(r.error!).endDate).toMatch(/on or after/);
  });
  it("only allows partial days on single dates", () => {
    expect(ptoSchema.safeParse({ ...base, isPartialDay: true }).success).toBe(false);
    expect(ptoSchema.safeParse({ ...base, endDate: base.startDate, isPartialDay: true }).success).toBe(true);
  });
  it("caps very long entries", () => {
    expect(ptoSchema.safeParse({ ...base, endDate: "2027-06-30" }).success).toBe(false);
  });
});

describe("capabilitySchema", () => {
  it("trims and limits names", () => {
    expect(capabilitySchema.parse({ name: " Payroll Tax ", description: "" }).name).toBe("Payroll Tax");
    expect(capabilitySchema.safeParse({ name: "x", description: "" }).success).toBe(false);
  });
});
