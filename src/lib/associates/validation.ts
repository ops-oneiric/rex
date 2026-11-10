import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { isValidTimeZone } from "@/lib/time-zones";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const associateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the associate's name.")
      .max(100, "Name must be 100 characters or fewer."),
    email: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.email("Enter a valid email address, or leave it blank.").nullable()),
    title: optionalText(100, "Title"),
    timeZone: z.string().refine(isValidTimeZone, "Choose a time zone."),
    canPm: z.boolean(),
    canPayroll: z.boolean(),
    targetLoad: z.coerce
      .number({ error: "Enter a number." })
      .min(1, "Target load must be at least 1.")
      .max(15, "Target load must be 15 or less.")
      .refine((v) => Number.isInteger(v * 2), "Use whole or half numbers, like 7 or 7.5."),
    isDirectlyManaged: z.boolean(),
  })
  .refine((v) => v.canPm || v.canPayroll, {
    path: ["seats"],
    message: "Choose at least one seat this associate can fill.",
  });

export type AssociateInput = z.infer<typeof associateSchema>;

export const PROFICIENCY_LABELS = ["None", "Learning", "Proficient", "Expert"] as const;

export const proficiencySchema = z.coerce.number().int().min(0).max(3);

export const capabilityNotesSchema = z
  .string()
  .trim()
  .max(4000, "Notes must be 4,000 characters or fewer.");

export const MAX_PTO_DAYS = 120;

export const ptoSchema = z
  .object({
    startDate: z.string().refine(isIsoDate, "Enter a start date."),
    endDate: z.string().refine(isIsoDate, "Enter an end date."),
    isPartialDay: z.boolean(),
    note: z.string().trim().max(200, "Note must be 200 characters or fewer."),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "The end date must be on or after the start date.",
  })
  .refine((v) => !v.isPartialDay || v.startDate === v.endDate, {
    path: ["isPartialDay"],
    message: "A partial day must start and end on the same date.",
  })
  .refine(
    (v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000 < MAX_PTO_DAYS,
    { path: ["endDate"], message: `PTO entries are limited to ${MAX_PTO_DAYS} days. Add longer leave as separate entries.` },
  );

export type PtoInput = z.infer<typeof ptoSchema>;

export const capabilitySchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(60, "Name must be 60 characters or fewer."),
  description: z.string().trim().max(200, "Description must be 200 characters or fewer."),
});

export type CapabilityInput = z.infer<typeof capabilitySchema>;

export function seatSummary(canPm: boolean, canPayroll: boolean): string {
  if (canPm && canPayroll) return "PM and Payroll (Hybrid-eligible)";
  if (canPm) return "PM only";
  if (canPayroll) return "Payroll only";
  return "No seats";
}
