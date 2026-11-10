"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, Flag, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import type { FormResult } from "@/lib/forms";
import { addFederalHolidaysAction, addHolidayAction, removeHolidayAction } from "./actions";

type Holiday = { date: string; name: string };

export function HolidayManager({ holidays, thisYear }: { holidays: Holiday[]; thisYear: number }) {
  const years = [...new Set([...holidays.map((h) => Number(h.date.slice(0, 4))), thisYear, thisYear + 1])].sort();
  const [year, setYear] = useState(thisYear);
  const [federal, setFederal] = useState<FormResult | null>(null);
  const [adding, startAdding] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [state, action, pending] = useActionState<FormResult, FormData>(addHolidayAction, {});
  const shown = holidays.filter((h) => h.date.startsWith(`${year}-`));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="holidayYear">Year</Label>
          <Select id="holidayYear" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <Button
          variant="secondary"
          disabled={adding}
          onClick={() => startAdding(async () => setFederal(await addFederalHolidaysAction(year)))}
        >
          <Flag aria-hidden="true" />
          {adding ? "Adding..." : `Add US federal holidays for ${year}`}
        </Button>
      </div>
      {federal?.message && <Alert tone={federal.ok ? "success" : "error"}>{federal.message}</Alert>}

      {shown.length === 0 ? (
        <p className="text-sm text-ink-muted">No holidays listed for {year}. Business days for {year} count every weekday.</p>
      ) : (
        <ul className="divide-y divide-rex-900/6 rounded-xl bg-white/40 ring-1 ring-rex-900/8">
          {shown.map((h) => (
            <li key={h.date} className="flex items-center gap-3 px-4 py-2.5">
              <span className="tabular w-36 shrink-0 text-sm text-ink">{formatDate(h.date, { withWeekday: true })}</span>
              <span className="min-w-0 flex-1 text-sm text-rex-950">{h.name}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={removing}
                aria-label={`Remove ${h.name} (${h.date})`}
                onClick={() => startRemoving(() => removeHolidayAction(h.date))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="holidayDate">Date</Label>
          <Input id="holidayDate" name="date" type="date" defaultValue={state.ok ? "" : state.values?.date} aria-invalid={!!state.errors?.date} />
          <FieldError message={state.errors?.date} />
        </div>
        <div>
          <Label htmlFor="holidayName">Holiday name</Label>
          <Input
            id="holidayName"
            name="name"
            maxLength={80}
            placeholder="e.g. Day after Thanksgiving"
            defaultValue={state.ok ? "" : state.values?.name}
            aria-invalid={!!state.errors?.name}
          />
          <FieldError message={state.errors?.name} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          <CalendarPlus aria-hidden="true" />
          Add holiday
        </Button>
      </form>
      {state.ok && state.message && <Alert tone="success">{state.message}</Alert>}
    </div>
  );
}
