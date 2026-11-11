export type CadenceStatus = "NEVER" | "ON_TRACK" | "DUE_SOON" | "OVERDUE";

export const CADENCE_STATUS_LABELS: Record<CadenceStatus, string> = {
  NEVER: "No 1:1 yet",
  ON_TRACK: "On track",
  DUE_SOON: "Due soon",
  OVERDUE: "Overdue",
};

/** Where an associate is in your 1:1 rhythm. "Due soon" is the last three days before it is overdue. */
export function cadenceStatus(
  lastOn: string | null,
  todayIso: string,
  frequencyDays: number,
): { status: CadenceStatus; daysSince: number | null } {
  if (!lastOn) return { status: "NEVER", daysSince: null };
  const daysSince = Math.round((Date.parse(todayIso) - Date.parse(lastOn)) / 86_400_000);
  if (daysSince > frequencyDays) return { status: "OVERDUE", daysSince };
  if (daysSince >= frequencyDays - 3) return { status: "DUE_SOON", daysSince };
  return { status: "ON_TRACK", daysSince };
}
