/**
 * General availability for the Associates page: who has the most room right now, for a PM
 * seat and for a payroll seat. Pure, so it can be unit-tested. This is a quick read of the
 * team, not a recommendation for a specific client (that's the Assign page).
 */
import { addBusinessDays, type HolidaySet, isBusinessDay } from "@/lib/business-days";
import { eachDay } from "@/lib/calendar-grid";
import type { Band, RuleSettings } from "@/lib/assignments/rules";

/** Look-ahead window, in business days: about four weeks, the same span as a fast start. */
export const AVAILABILITY_WINDOW = 20;
/** Load-equivalent cost of one business day of PTO inside the window. */
const PTO_DAY_COST = 0.5;
/** Load-equivalent cost of one go-live inside the window, for a payroll seat. */
const FIRST_INPUT_COST = 1;

export type AvailabilityInput = {
  id: number;
  name: string;
  isActive: boolean;
  canPm: boolean;
  canPayroll: boolean;
  targetLoad: number;
  load: number;
  band: Band;
  pto: { startDate: string; endDate: string; isPartialDay: boolean }[];
  /** First input dates of Implementation clients they hold. */
  firstInputs: string[];
};

export type AvailabilityRow = {
  id: number;
  name: string;
  score: number;
  room: number;
  load: number;
  targetLoad: number;
  band: Band;
  ptoDays: number;
  nextPto: { startDate: string; endDate: string } | null;
  outToday: boolean;
  firstInputsSoon: number;
};

export function rankAvailability(
  people: AvailabilityInput[],
  role: "PM" | "PAYROLL",
  ctx: { today: string; holidays: HolidaySet; rules: RuleSettings },
  limit = 3,
): AvailabilityRow[] {
  const end = addBusinessDays(ctx.today, AVAILABILITY_WINDOW, ctx.holidays);
  const windowDays = eachDay(ctx.today, end).filter((d) => isBusinessDay(d, ctx.holidays));
  // Go-lives weigh less for a PM, the same way the rules engine treats them (hybrid people
  // appear in the payroll list, where they count fully).
  const goLiveCost = role === "PM" ? FIRST_INPUT_COST * ctx.rules.pmDateWeight : FIRST_INPUT_COST;

  return people
    .filter((p) => p.isActive && (role === "PM" ? p.canPm : p.canPayroll))
    .map((p) => {
      const upcomingPto = p.pto.filter((x) => x.endDate >= ctx.today && x.startDate <= end).sort((a, b) => a.startDate.localeCompare(b.startDate));
      const ptoDays = windowDays.reduce((sum, d) => {
        const off = upcomingPto.find((x) => x.startDate <= d && x.endDate >= d);
        return off ? sum + (off.isPartialDay ? 0.5 : 1) : sum;
      }, 0);
      const firstInputsSoon = p.firstInputs.filter((d) => d >= ctx.today && d <= end).length;
      const room = Math.round((p.targetLoad - p.load) * 100) / 100;
      const score = Math.round((room - ptoDays * PTO_DAY_COST - firstInputsSoon * goLiveCost) * 100) / 100;
      return {
        id: p.id,
        name: p.name,
        score,
        room,
        load: p.load,
        targetLoad: p.targetLoad,
        band: p.band,
        ptoDays,
        nextPto: upcomingPto[0] ? { startDate: upcomingPto[0].startDate, endDate: upcomingPto[0].endDate } : null,
        outToday: upcomingPto.some((x) => x.startDate <= ctx.today && x.endDate >= ctx.today && !x.isPartialDay),
        firstInputsSoon,
      };
    })
    .sort((a, b) => b.score - a.score || a.load - b.load || a.name.localeCompare(b.name))
    .slice(0, limit);
}
