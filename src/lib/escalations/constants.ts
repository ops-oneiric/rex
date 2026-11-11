export const ESCALATION_CATEGORIES = [
  "PAYROLL_ERROR",
  "TAX",
  "BENEFITS",
  "MISSED_DEADLINE",
  "COMMUNICATION",
  "DATA_SETUP",
  "SYSTEM",
  "OTHER",
] as const;
export type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<EscalationCategory, string> = {
  PAYROLL_ERROR: "Payroll error",
  TAX: "Tax",
  BENEFITS: "Benefits",
  MISSED_DEADLINE: "Missed deadline",
  COMMUNICATION: "Communication",
  DATA_SETUP: "Data or setup",
  SYSTEM: "System",
  OTHER: "Other",
};

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABELS: Record<Severity, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };

export const FAULT_PARTIES = ["ASSOCIATE", "CLIENT", "INTERNAL_PROCESS", "PRODUCT_SYSTEM", "THIRD_PARTY", "SHARED", "UNDETERMINED"] as const;
export type FaultParty = (typeof FAULT_PARTIES)[number];
export const FAULT_LABELS: Record<FaultParty, string> = {
  ASSOCIATE: "Associate",
  CLIENT: "Client",
  INTERNAL_PROCESS: "Internal process",
  PRODUCT_SYSTEM: "Product or system",
  THIRD_PARTY: "Third party",
  SHARED: "Shared",
  UNDETERMINED: "Undetermined",
};

export const PREVENTABLE = ["YES", "NO", "UNCLEAR"] as const;
export type Preventable = (typeof PREVENTABLE)[number];
export const PREVENTABLE_LABELS: Record<Preventable, string> = { YES: "Yes", NO: "No", UNCLEAR: "Unclear" };
