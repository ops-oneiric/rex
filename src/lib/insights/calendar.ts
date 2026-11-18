import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getRuleSettings } from "@/lib/settings";
import { formatDate } from "@/lib/dates";
import { clientContext, listClients, withFacts } from "@/lib/clients/data";
import { clientLabel } from "@/lib/clients/constants";
import { SEATS_BY_MODEL } from "@/lib/assignments/seats";
import { businessDaysBetween } from "@/lib/business-days";
import { addMonths, lastDayOf, monthOf } from "@/lib/calendar-grid";
import type { PtoConflict } from "./metrics";

export type CalendarFirstInput = {
  kind: "FIRST_INPUT";
  date: string;
  clientId: number;
  code: string;
  label: string;
  stage: "IMPLEMENTATION" | "PROSPECT";
  team: { id: number; name: string }[];
  openSeats: number;
  fastStart: boolean;
  /** A team member has another first input within the conflict window. */
  collision: boolean;
};

export type CalendarPto = {
  kind: "PTO";
  id: number;
  associateId: number;
  name: string;
  start: string;
  end: string;
  partial: boolean;
  note: string;
  level: "red" | "amber" | null;
  conflicts: string[];
};

export type CalendarHoliday = { kind: "HOLIDAY"; date: string; name: string };

export type CalendarData = {
  today: string;
  months: string[];
  firstInputs: CalendarFirstInput[];
  pto: CalendarPto[];
  holidays: CalendarHoliday[];
  associates: { id: number; name: string }[];
};

const MONTHS_AHEAD = 6;

/**
 * Everything the dashboard calendar shows, from the start of this month through the next
 * five: first input dates (implementations, and prospects that have one), PTO for active
 * associates with any conflicts against clients they hold, and holidays.
 */
export function calendarData(conflicts: PtoConflict[]): CalendarData {
  const ctx = clientContext();
  const rules = getRuleSettings();
  const first = monthOf(ctx.today);
  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => addMonths(first, i));
  const start = `${first}-01`;
  const end = lastDayOf(months.at(-1)!);

  const people = db
    .select({ id: schema.associates.id, name: schema.associates.name })
    .from(schema.associates)
    .where(eq(schema.associates.isActive, true))
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));
  const names = new Map(people.map((p) => [p.id, p.name]));

  const facts = withFacts(listClients(), ctx).filter((c) => c.lifecycleStage !== "SERVICE");
  const held = db
    .select({ clientId: schema.assignments.clientId, associateId: schema.assignments.associateId })
    .from(schema.assignments)
    .where(eq(schema.assignments.status, "ACTIVE"))
    .all();
  const byClient = new Map(facts.map((c) => [c.id, c]));

  const firstInputs: CalendarFirstInput[] = facts
    .filter((c) => c.firstInputDate && c.firstInputDate >= start && c.firstInputDate <= end)
    .map((c) => {
      const team = held.filter((h) => h.clientId === c.id).map((h) => ({ id: h.associateId, name: names.get(h.associateId) ?? "Inactive associate" }));
      const collision =
        c.lifecycleStage === "IMPLEMENTATION" &&
        team.some((m) =>
          held
            .filter((o) => o.associateId === m.id && o.clientId !== c.id)
            .map((o) => byClient.get(o.clientId))
            .some((o) => o?.lifecycleStage === "IMPLEMENTATION" && o.firstInputDate && Math.abs(businessDaysBetween(c.firstInputDate!, o.firstInputDate, ctx.holidays)) <= rules.collisionConflict),
        );
      return {
        kind: "FIRST_INPUT" as const,
        date: c.firstInputDate!,
        clientId: c.id,
        code: c.companyCode ?? c.displayName ?? "Client",
        label: clientLabel(c),
        stage: c.lifecycleStage as "IMPLEMENTATION" | "PROSPECT",
        team,
        openSeats: c.supportModel ? Math.max(SEATS_BY_MODEL[c.supportModel].length - team.length, 0) : 0,
        fastStart: c.fastStart?.isFastStart ?? false,
        collision,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));

  const pto: CalendarPto[] = db
    .select()
    .from(schema.associatePto)
    .where(and(lte(schema.associatePto.startDate, end), gte(schema.associatePto.endDate, start)))
    .all()
    .filter((p) => names.has(p.associateId))
    .map((p) => {
      const mine = conflicts.filter((c) => c.ptoId === p.id);
      return {
        kind: "PTO" as const,
        id: p.id,
        associateId: p.associateId,
        name: names.get(p.associateId)!,
        start: p.startDate,
        end: p.endDate,
        partial: p.isPartialDay,
        note: p.note,
        level: mine.some((c) => c.level === "red") ? "red" : mine.length ? "amber" : null,
        conflicts: mine.map((c) => `${c.role} on ${c.clientLabel}: ${c.kind === "FIRST_INPUT" ? "first input" : "benefits start"} ${formatDate(c.date)}`),
      } satisfies CalendarPto;
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));

  const holidays: CalendarHoliday[] = db
    .select()
    .from(schema.holidays)
    .where(and(gte(schema.holidays.date, start), lte(schema.holidays.date, end)))
    .all()
    .map((h) => ({ kind: "HOLIDAY" as const, date: h.date, name: h.name }));

  return { today: ctx.today, months, firstInputs, pto, holidays, associates: people };
}
