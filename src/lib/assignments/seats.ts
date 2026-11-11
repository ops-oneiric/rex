import type { SupportModel } from "@/lib/clients/constants";

/** A seat on a client's team. PM-model clients have two payroll seats. */
export const SEATS = ["HYBRID", "PM", "PAYROLL_1", "PAYROLL_2"] as const;
export type Seat = (typeof SEATS)[number];
export type SeatRole = "HYBRID" | "PM" | "PAYROLL";

export const SEATS_BY_MODEL: Record<SupportModel, Seat[]> = {
  HYBRID: ["HYBRID"],
  TRADITIONAL: ["PM", "PAYROLL_1"],
  PM: ["PM", "PAYROLL_1", "PAYROLL_2"],
};

export function seatRole(seat: Seat): SeatRole {
  return seat === "HYBRID" ? "HYBRID" : seat === "PM" ? "PM" : "PAYROLL";
}

export function seatLabel(seat: Seat, model: SupportModel | null): string {
  if (seat === "HYBRID") return "Hybrid (PM and payroll)";
  if (seat === "PM") return "PM";
  if (model === "PM") return seat === "PAYROLL_1" ? "Payroll 1" : "Payroll 2";
  return "Payroll";
}

/** Whether an associate's seat eligibility covers a seat. */
export function canFill(role: SeatRole, a: { canPm: boolean; canPayroll: boolean }): boolean {
  if (role === "HYBRID") return a.canPm && a.canPayroll;
  return role === "PM" ? a.canPm : a.canPayroll;
}

/** Payroll and hybrid seats follow the strict PTO rules. */
export function isPayrollRole(role: SeatRole): boolean {
  return role !== "PM";
}
