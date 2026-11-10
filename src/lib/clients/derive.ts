import { businessDaysBetween, isFastStart, type HolidaySet } from "@/lib/business-days";
import type { ImplementationType, PreviousVendor, Stage } from "./constants";
import { computeWeight, type WeightBreakdown, type WeightSettings } from "./weight";

export type ClientFacts = {
  lifecycleStage: Stage;
  firstInputDate: string | null;
  benefitsStartDate: string | null;
  assignedOn: string | null;
  employeeCount: number | null;
  controlCount: number | null;
  payrollComplexity: number | null;
  implementationType: ImplementationType | null;
  previousVendor: PreviousVendor | null;
};

export type FastStart =
  /** Assigned: fixed by the actual assignment date. */
  | { kind: "fixed"; isFastStart: boolean }
  /** Not yet assigned: what it would be if assigned today. */
  | { kind: "projected"; isFastStart: boolean }
  | null;

export type DerivedClient = {
  /** Business days from today to first input (negative once it has passed). */
  businessDaysToFirstInput: number | null;
  /** Business days from first input to benefits start (negative = benefits start first). */
  benefitsOffset: number | null;
  fastStart: FastStart;
  weight: WeightBreakdown;
};

export function deriveClient(
  c: ClientFacts,
  ctx: { today: string; holidays: HolidaySet; weights: WeightSettings },
): DerivedClient {
  const fid = c.firstInputDate;
  let fastStart: FastStart = null;
  if (fid && c.assignedOn) fastStart = { kind: "fixed", isFastStart: isFastStart(c.assignedOn, fid, ctx.holidays) };
  else if (fid && c.lifecycleStage !== "SERVICE")
    fastStart = { kind: "projected", isFastStart: isFastStart(ctx.today, fid, ctx.holidays) };

  return {
    businessDaysToFirstInput: fid ? businessDaysBetween(ctx.today, fid, ctx.holidays) : null,
    benefitsOffset: fid && c.benefitsStartDate ? businessDaysBetween(fid, c.benefitsStartDate, ctx.holidays) : null,
    fastStart,
    weight: computeWeight(c, fastStart?.isFastStart ?? false, ctx.weights),
  };
}
