import "server-only";
import { listHolidays } from "@/lib/holidays";
import { getComplexityScale, getWeightSettings, today } from "@/lib/settings";
import { otherTimeZones } from "@/lib/time-zones";

/** Everything the client form needs from the server. */
export function clientFormContext() {
  return {
    otherZones: otherTimeZones(),
    complexityScale: getComplexityScale(),
    weights: getWeightSettings(),
    today: today(),
    holidays: listHolidays().map((h) => h.date),
  };
}
