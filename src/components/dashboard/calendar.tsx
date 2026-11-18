"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, OctagonAlert, Plane, TriangleAlert, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { addDays, formatDate } from "@/lib/dates";
import { monthOf, monthWeeks, shortName } from "@/lib/calendar-grid";
import type { CalendarData, CalendarFirstInput, CalendarPto } from "@/lib/insights/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;
const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayTitle = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Day = { firstInputs: CalendarFirstInput[]; pto: CalendarPto[]; holiday: string | null };

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Event chip. Shape and icon carry the meaning too, so it never relies on colour alone. */
function FirstInputChip({ e }: { e: CalendarFirstInput }) {
  const prospect = e.stage === "PROSPECT";
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] leading-tight font-medium",
        prospect ? "border border-dashed border-rex-400 text-rex-800" : "bg-rex-600 text-white",
        e.collision && "ring-2 ring-red-600 ring-offset-1 ring-offset-white",
      )}
    >
      {e.collision ? <OctagonAlert className="size-3 shrink-0" aria-hidden="true" /> : <Flag className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate font-mono tracking-wide">{e.code}</span>
    </span>
  );
}

function PtoChip({ p }: { p: CalendarPto }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] leading-tight",
        p.level === "red" ? "bg-red-50 text-red-800 ring-1 ring-red-600/30" : p.level === "amber" ? "bg-amber-50 text-amber-800 ring-1 ring-amber-600/30" : "bg-rex-100 text-rex-900",
      )}
    >
      {p.level ? <TriangleAlert className="size-3 shrink-0" aria-hidden="true" /> : <Plane className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{shortName(p.name)}</span>
    </span>
  );
}

export function DashboardCalendar({ data }: { data: CalendarData }) {
  const [monthIndex, setMonthIndex] = useState(0);
  const [selected, setSelected] = useState(data.today);
  const [show, setShow] = useState({ firstInputs: true, prospects: true, pto: true });
  const [person, setPerson] = useState<string>("all");
  const gridRef = useRef<HTMLTableElement>(null);
  const month = data.months[monthIndex]!;
  const weeks = useMemo(() => monthWeeks(month), [month]);

  const dayInfo = useMemo(() => {
    const who = person === "all" ? null : Number(person);
    const firstInputs = data.firstInputs.filter(
      (e) => (e.stage === "PROSPECT" ? show.prospects : show.firstInputs) && (who === null || e.team.some((m) => m.id === who)),
    );
    const pto = show.pto ? data.pto.filter((p) => who === null || p.associateId === who) : [];
    const holidays = new Map(data.holidays.map((h) => [h.date, h.name]));
    return (date: string): Day => ({
      firstInputs: firstInputs.filter((e) => e.date === date),
      pto: pto.filter((p) => p.start <= date && p.end >= date),
      holiday: holidays.get(date) ?? null,
    });
  }, [data, show, person]);

  const first = `${data.months[0]}-01`;
  const lastMonth = data.months.at(-1)!;
  const select = (date: string, focus = false) => {
    const m = data.months.indexOf(monthOf(date));
    if (m === -1) return;
    setSelected(date);
    setMonthIndex(m);
    if (focus) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus());
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = addDays(selected, step);
    if (next >= first && monthOf(next) <= lastMonth) select(next, true);
  };
  const goMonth = (i: number) => {
    setMonthIndex(i);
    const target = data.months[i]!;
    setSelected(i === 0 ? data.today : `${target}-01`);
  };

  const selectedDay = dayInfo(selected);
  const toggle = (key: keyof typeof show, label: string, swatch: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={show[key]}
      onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs font-medium ring-1 transition-colors ring-inset",
        show[key] ? "bg-white/80 text-rex-950 ring-rex-900/12" : "text-ink-muted ring-transparent line-through decoration-rex-300 hover:bg-white/50",
      )}
    >
      {swatch}
      {label}
    </button>
  );

  return (
    <Card>
      <CardHeader
        icon={<CalendarDays />}
        title="Calendar"
        description="First input dates and time off for the next six months. Choose a day for details."
      />

      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => goMonth(monthIndex - 1)}
          disabled={monthIndex === 0}
          className="grid size-8 place-items-center rounded-lg text-rex-800 hover:bg-white/70 disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <h3 className="min-w-36 text-center text-sm font-semibold text-rex-950" aria-live="polite">
          {monthTitle.format(at(`${month}-01`))}
        </h3>
        <button
          type="button"
          onClick={() => goMonth(monthIndex + 1)}
          disabled={monthIndex === data.months.length - 1}
          className="grid size-8 place-items-center rounded-lg text-rex-800 hover:bg-white/70 disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
        {(monthIndex !== 0 || selected !== data.today) && (
          <button type="button" onClick={() => goMonth(0)} aria-label="Go to today" className="ml-1 h-8 rounded-lg px-2.5 text-xs font-medium text-rex-700 hover:bg-white/70">
            Today
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Show on the calendar">
        {toggle("firstInputs", "First inputs", <span className="size-3 rounded-[3px] bg-rex-600" aria-hidden="true" />)}
        {toggle("prospects", "Prospect first inputs", <span className="size-3 rounded-[3px] border border-dashed border-rex-400" aria-hidden="true" />)}
        {toggle("pto", "Time off", <span className="size-3 rounded-[3px] bg-rex-100 ring-1 ring-rex-300" aria-hidden="true" />)}
        <Select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Show one associate" className="ml-auto h-8 w-auto py-0 text-xs">
          <option value="all">Everyone</option>
          {data.associates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="-mx-1 overflow-hidden px-1">
        <table ref={gridRef} className="w-full table-fixed border-separate border-spacing-0.5" onKeyDown={onKeyDown}>
          <caption className="sr-only">{monthTitle.format(at(`${month}-01`))}. Use the arrow keys to move between days.</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="pb-1 text-center text-[11px] font-medium text-ink-muted">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]!.date}>
                {week.map(({ date, inMonth }) => {
                  const day = dayInfo(date);
                  const isToday = date === data.today;
                  const isSelected = date === selected;
                  const past = date < data.today;
                  const weekend = [0, 6].includes(at(date).getUTCDay());
                  const chips = [...day.firstInputs.map((e) => ({ key: `f${e.clientId}`, node: <FirstInputChip e={e} /> })), ...day.pto.map((p) => ({ key: `p${p.id}`, node: <PtoChip p={p} /> }))];
                  const counts = [
                    day.firstInputs.length && plural(day.firstInputs.length, "first input"),
                    day.pto.length && `${day.pto.length} on time off`,
                    day.holiday,
                  ].filter(Boolean);
                  const selectable = date >= first && monthOf(date) <= lastMonth;
                  return (
                    <td key={date} className="h-14 align-top sm:h-28">
                      <button
                        type="button"
                        data-date={date}
                        disabled={!selectable}
                        tabIndex={isSelected ? 0 : -1}
                        aria-pressed={isSelected}
                        aria-label={`${dayTitle.format(at(date))}${isToday ? ", today" : ""}${counts.length ? `: ${counts.join(", ")}` : ""}`}
                        onClick={() => select(date)}
                        className={cn(
                          "flex h-full w-full flex-col gap-0.5 overflow-hidden rounded-lg p-1 text-left ring-inset transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rex-500",
                          inMonth ? (weekend ? "bg-white/35" : "bg-white/60") : "bg-transparent",
                          isSelected ? "ring-2 ring-rex-700" : "hover:bg-white/90",
                          (!inMonth || past) && "opacity-55",
                        )}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs",
                              isToday ? "bg-rex-900 font-semibold text-white" : "text-ink",
                            )}
                          >
                            {Number(date.slice(8))}
                          </span>
                          {day.holiday && <span className="hidden truncate text-[10px] text-ink-muted lg:inline">{day.holiday}</span>}
                        </span>
                        {/* Chips on wider screens, dots on a phone. */}
                        <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                          {chips.slice(0, MAX_CHIPS).map((c) => (
                            <span key={c.key} className="block min-w-0">
                              {c.node}
                            </span>
                          ))}
                          {chips.length > MAX_CHIPS && <span className="px-1 text-[11px] text-ink-muted">+{chips.length - MAX_CHIPS} more</span>}
                        </span>
                        {chips.length > 0 && (
                          <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                            {day.firstInputs.map((e) => (
                              <span key={e.clientId} className={cn("size-1.5 rounded-full", e.stage === "PROSPECT" ? "border border-rex-500" : "bg-rex-600", e.collision && "bg-red-600")} />
                            ))}
                            {day.pto.map((p) => (
                              <span key={p.id} className={cn("size-1.5 rounded-full", p.level === "red" ? "bg-red-600" : p.level === "amber" ? "bg-amber-500" : "bg-rex-300")} />
                            ))}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-live="polite" aria-label="Selected day" className="mt-4 rounded-xl bg-white/50 p-4 ring-1 ring-rex-900/8">
        <h3 className="text-sm font-semibold text-rex-950">
          {dayTitle.format(at(selected))}
          {selected === data.today && <span className="font-normal text-ink-muted"> · today</span>}
        </h3>
        {selectedDay.holiday && <p className="mt-1 text-xs text-ink-muted">Holiday: {selectedDay.holiday}</p>}
        {selectedDay.firstInputs.length === 0 && selectedDay.pto.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing scheduled.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rex-900/6 text-sm">
            {selectedDay.firstInputs.map((e) => (
              <li key={e.clientId} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Flag className="size-4 text-rex-600" aria-hidden="true" />
                  <Link href={`/clients/${e.clientId}`} className="font-medium text-rex-950 hover:underline">
                    {e.label}
                  </Link>
                  <span className="text-xs text-ink-muted">{e.stage === "PROSPECT" ? "Prospect first input" : "First input"}</span>
                  {e.fastStart && (
                    <Badge tone="warning">
                      <Zap aria-hidden="true" />
                      Fast start
                    </Badge>
                  )}
                  {e.collision && (
                    <Badge tone="danger">
                      <OctagonAlert aria-hidden="true" />
                      First input collision
                    </Badge>
                  )}
                  {e.openSeats > 0 && (
                    <Link href={`/assign/${e.clientId}`}>
                      <Badge tone="warning">{plural(e.openSeats, "open seat")}</Badge>
                    </Link>
                  )}
                </div>
                <p className="mt-0.5 pl-6 text-xs text-ink-muted">{e.team.length ? `Team: ${e.team.map((m) => m.name).join(", ")}` : "No team yet"}</p>
              </li>
            ))}
            {selectedDay.pto.map((p) => (
              <li key={p.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Plane className="size-4 text-rex-500" aria-hidden="true" />
                  <Link href={`/associates/${p.associateId}?tab=pto`} className="font-medium text-rex-950 hover:underline">
                    {p.name}
                  </Link>
                  <span className="tabular text-xs text-ink-muted">
                    Time off {p.start === p.end ? formatDate(p.start) : `${formatDate(p.start)} to ${formatDate(p.end)}`}
                    {p.partial && " (partial day)"}
                  </span>
                </div>
                {p.note && <p className="mt-0.5 pl-6 text-xs text-ink-muted">{p.note}</p>}
                {p.conflicts.map((c) => (
                  <p key={c} className={cn("mt-0.5 flex items-start gap-1.5 pl-6 text-xs", p.level === "red" ? "text-red-800" : "text-amber-800")}>
                    <span className="sr-only">Conflict: </span>
                    {c}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
