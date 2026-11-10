export const STAGES = ["PROSPECT", "IMPLEMENTATION", "SERVICE"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  PROSPECT: "Prospect",
  IMPLEMENTATION: "Implementation",
  SERVICE: "Service",
};

export const IMPLEMENTATION_TYPES = ["NEW_LOGO", "ADD_CONTROL"] as const;
export type ImplementationType = (typeof IMPLEMENTATION_TYPES)[number];
export const IMPLEMENTATION_TYPE_LABELS: Record<ImplementationType, string> = {
  NEW_LOGO: "New Logo",
  ADD_CONTROL: "Add Control",
};

export const SUPPORT_MODELS = ["HYBRID", "TRADITIONAL", "PM"] as const;
export type SupportModel = (typeof SUPPORT_MODELS)[number];
export const SUPPORT_MODEL_LABELS: Record<SupportModel, string> = {
  HYBRID: "Hybrid",
  TRADITIONAL: "Traditional",
  PM: "PM model",
};
export const SUPPORT_MODEL_SEATS: Record<SupportModel, string> = {
  HYBRID: "1 associate: PM and payroll",
  TRADITIONAL: "2 associates: 1 PM, 1 payroll",
  PM: "3 associates: 1 PM, 2 payroll",
};

export const PREVIOUS_VENDORS = ["IN_HOUSE", "NEW"] as const;
export type PreviousVendor = (typeof PREVIOUS_VENDORS)[number];
export const PREVIOUS_VENDOR_LABELS: Record<PreviousVendor, string> = {
  IN_HOUSE: "In-house",
  NEW: "New",
};

export const DEFAULT_COMPLEXITY_SCALE: [string, string, string, string, string] = [
  "Simple: one pay frequency, standard earnings and deductions.",
  "Light: a few pay groups or some extra earnings and deductions.",
  "Moderate: several pay frequencies or groups, some special pay rules.",
  "Complex: many pay rules, multi-state taxes or tricky deductions.",
  "Very complex: union or certified payroll, job costing, heavy integrations.",
];

/** Fields that must be filled in before a client can be in Implementation or Service. */
export const REQUIRED_FOR_IMPLEMENTATION = [
  ["companyCode", "Company code"],
  ["implementationType", "Implementation type"],
  ["supportModel", "Support model"],
  ["employeeCount", "Employee count"],
  ["firstInputDate", "First input date"],
  ["timeZone", "Time zone"],
  ["controlCount", "Control count"],
  ["payrollComplexity", "Payroll complexity"],
  ["previousVendor", "Previous vendor"],
] as const;

/** "ABC · Acme Co", "ABC" or "Acme Co". */
export function clientLabel(c: { companyCode: string | null; displayName: string | null }): string {
  return [c.companyCode, c.displayName].filter(Boolean).join(" · ") || "Unnamed client";
}
