import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { isValidTimeZone } from "@/lib/time-zones";
import {
  IMPLEMENTATION_TYPES,
  PREVIOUS_VENDORS,
  REQUIRED_FOR_IMPLEMENTATION,
  STAGES,
  SUPPORT_MODELS,
  type Stage,
} from "./constants";

/** "" becomes null, so optional fields can be left blank on prospects. */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankToNull, schema.nullable());

const wholeNumber = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Enter the ${label}.` })
    .int(`The ${label} must be a whole number.`)
    .min(min, `The ${label} must be at least ${min}.`)
    .max(max, `The ${label} must be ${max.toLocaleString()} or less.`);

export const COMPANY_CODE_PATTERN = /^[A-Z0-9]{3}$/;

export const clientSchema = z
  .object({
    companyCode: optional(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(COMPANY_CODE_PATTERN, "Company codes are exactly 3 letters or digits."),
    ),
    displayName: optional(z.string().trim().max(100, "Name must be 100 characters or fewer.")),
    lifecycleStage: z.enum(STAGES),
    implementationType: optional(z.enum(IMPLEMENTATION_TYPES)),
    supportModel: optional(z.enum(SUPPORT_MODELS)),
    employeeCount: optional(wholeNumber("employee count", 1, 100_000)),
    firstInputDate: optional(z.string().refine(isIsoDate, "Enter a valid date.")),
    benefitsStartDate: optional(z.string().refine(isIsoDate, "Enter a valid date.")),
    timeZone: optional(z.string().refine(isValidTimeZone, "Choose a time zone.")),
    controlCount: optional(wholeNumber("control count", 1, 500)),
    payrollComplexity: optional(wholeNumber("complexity", 1, 5)),
    previousVendor: optional(z.enum(PREVIOUS_VENDORS)),
    notes: z.string().trim().max(4000, "Notes must be 4,000 characters or fewer."),
  })
  .refine((v) => v.companyCode || v.displayName, {
    path: ["companyCode"],
    message: "Enter a company code or a name so you can find this client.",
  })
  .superRefine((v, ctx) => {
    for (const [field, label] of missingForStage(v, v.lifecycleStage)) {
      ctx.addIssue({ code: "custom", path: [field], message: `${label} is required for ${stageWord(v.lifecycleStage)} clients.` });
    }
  });

export type ClientInput = z.infer<typeof clientSchema>;

function stageWord(stage: Stage) {
  return stage === "SERVICE" ? "Service" : "Implementation";
}

/** Required fields still empty for the given stage (none for prospects). */
export function missingForStage(
  client: Partial<Record<(typeof REQUIRED_FOR_IMPLEMENTATION)[number][0], unknown>>,
  stage: Stage,
): (typeof REQUIRED_FOR_IMPLEMENTATION)[number][] {
  if (stage === "PROSPECT") return [];
  return REQUIRED_FOR_IMPLEMENTATION.filter(([field]) => client[field] === null || client[field] === undefined);
}

/** Clients move one stage at a time, forward or back. */
export function allowedTransitions(stage: Stage): Stage[] {
  const i = STAGES.indexOf(stage);
  return STAGES.filter((_, j) => Math.abs(i - j) === 1);
}

export const stageChangeNoteSchema = z.string().trim().max(500, "Note must be 500 characters or fewer.");
