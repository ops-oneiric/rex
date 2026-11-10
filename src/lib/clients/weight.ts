import { z } from "zod";
import type { ImplementationType, PreviousVendor } from "./constants";

/** Workload weight settings (Settings > Clients & rules). A typical account is about 1.0. */
export const weightSettingsSchema = z.object({
  base: z.number().min(0).max(5),
  employees50: z.number().min(0).max(5),
  employees200: z.number().min(0).max(5),
  employees500: z.number().min(0).max(5),
  perExtraControl: z.number().min(0).max(5),
  controlCap: z.number().min(0).max(5),
  complexity: z.tuple([
    z.number().min(0).max(5),
    z.number().min(0).max(5),
    z.number().min(0).max(5),
    z.number().min(0).max(5),
    z.number().min(0).max(5),
  ]),
  newLogo: z.number().min(0).max(5),
  addControl: z.number().min(0).max(5),
  inHouse: z.number().min(0).max(5),
  newVendor: z.number().min(0).max(5),
  fastStart: z.number().min(0).max(5),
});

export type WeightSettings = z.infer<typeof weightSettingsSchema>;

export const DEFAULT_WEIGHTS: WeightSettings = {
  base: 0.5,
  employees50: 0.2,
  employees200: 0.4,
  employees500: 0.6,
  perExtraControl: 0.1,
  controlCap: 0.5,
  complexity: [0, 0.1, 0.2, 0.3, 0.4],
  newLogo: 0.2,
  addControl: 0,
  inHouse: 0,
  newVendor: 0,
  fastStart: 0.2,
};

export type WeightInputs = {
  employeeCount: number | null;
  controlCount: number | null;
  payrollComplexity: number | null;
  implementationType: ImplementationType | null;
  previousVendor: PreviousVendor | null;
};

export type WeightBreakdown = {
  total: number;
  parts: { label: string; value: number }[];
  /** True when some inputs are missing (usually a prospect), so the total is a floor. */
  incomplete: boolean;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function computeWeight(c: WeightInputs, isFastStart: boolean, w: WeightSettings = DEFAULT_WEIGHTS): WeightBreakdown {
  const parts: { label: string; value: number }[] = [{ label: "Base", value: w.base }];
  let incomplete = false;

  if (c.employeeCount === null) incomplete = true;
  else {
    const n = c.employeeCount;
    const [label, value] =
      n >= 500 ? ["500+ employees", w.employees500]
      : n >= 200 ? ["200-499 employees", w.employees200]
      : n >= 50 ? ["50-199 employees", w.employees50]
      : ["1-49 employees", 0];
    parts.push({ label, value });
  }

  if (c.controlCount === null) incomplete = true;
  else {
    const extra = Math.max(0, c.controlCount - 1);
    parts.push({
      label: `${c.controlCount} control${c.controlCount === 1 ? "" : "s"}`,
      value: Math.min(extra * w.perExtraControl, w.controlCap),
    });
  }

  if (c.payrollComplexity === null) incomplete = true;
  else parts.push({ label: `Complexity ${c.payrollComplexity}`, value: w.complexity[c.payrollComplexity - 1] ?? 0 });

  if (c.implementationType === null) incomplete = true;
  else
    parts.push(
      c.implementationType === "NEW_LOGO"
        ? { label: "New Logo", value: w.newLogo }
        : { label: "Add Control", value: w.addControl },
    );

  if (c.previousVendor === null) incomplete = true;
  else
    parts.push(
      c.previousVendor === "IN_HOUSE"
        ? { label: "Previously in-house", value: w.inHouse }
        : { label: "Previous vendor: New", value: w.newVendor },
    );

  if (isFastStart) parts.push({ label: "Fast start", value: w.fastStart });

  const rounded = parts.map((p) => ({ ...p, value: round(p.value) }));
  return { total: round(rounded.reduce((sum, p) => sum + p.value, 0)), parts: rounded, incomplete };
}
