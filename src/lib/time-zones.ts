/** US zones first (most clients and associates), then every other IANA zone. */
export const COMMON_TIME_ZONES = [
  { id: "America/New_York", label: "Eastern" },
  { id: "America/Chicago", label: "Central" },
  { id: "America/Denver", label: "Mountain" },
  { id: "America/Phoenix", label: "Arizona (no DST)" },
  { id: "America/Los_Angeles", label: "Pacific" },
  { id: "America/Anchorage", label: "Alaska" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
  { id: "America/Puerto_Rico", label: "Atlantic (Puerto Rico)" },
] as const;

export const DEFAULT_TIME_ZONE = "America/Chicago";

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function otherTimeZones(): string[] {
  const common = new Set<string>(COMMON_TIME_ZONES.map((z) => z.id));
  return Intl.supportedValuesOf("timeZone").filter((z) => !common.has(z));
}

/** Short label: "Central" for common zones, otherwise the city, e.g. "Europe / London". */
export function timeZoneLabel(id: string): string {
  const common = COMMON_TIME_ZONES.find((z) => z.id === id);
  if (common) return common.label;
  return id.replace(/_/g, " ").replace(/\//g, " / ");
}

/** Current UTC offset, e.g. "GMT-6". */
export function timeZoneOffset(id: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: id, timeZoneName: "shortOffset" }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
