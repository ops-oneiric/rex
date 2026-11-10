"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label } from "@/components/ui/input";
import { countWeekdays, formatDateRange } from "@/lib/dates";
import type { FormResult } from "@/lib/forms";
import { deletePtoAction } from "../actions";

type PtoRow = { id: number; startDate: string; endDate: string; isPartialDay: boolean; note: string };

export function PtoPanel({
  associateId,
  name,
  action,
  entries,
  today,
}: {
  associateId: number;
  name: string;
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  entries: PtoRow[];
  today: string;
}) {
  const upcoming = entries.filter((p) => p.endDate >= today);
  const past = entries.filter((p) => p.endDate < today).reverse();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card className="p-0">
          <div className="p-6 pb-2">
            <h2 className="text-base font-semibold text-rex-950">Upcoming and current</h2>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarPlus />}
              title="No PTO scheduled"
              description={`Add ${name}'s time off so Rex can keep them off clients going live while they're out.`}
            />
          ) : (
            <PtoList associateId={associateId} rows={upcoming} today={today} />
          )}
        </Card>
        {past.length > 0 && (
          <Card className="p-0">
            <details>
              <summary className="cursor-pointer p-6 text-sm font-medium text-rex-900 select-none">
                Past PTO ({past.length})
              </summary>
              <PtoList associateId={associateId} rows={past} today={today} />
            </details>
          </Card>
        )}
      </div>
      <AddPtoForm action={action} today={today} />
    </div>
  );
}

function PtoList({ associateId, rows, today }: { associateId: number; rows: PtoRow[]; today: string }) {
  return (
    <ul className="divide-y divide-rex-900/6 border-t border-rex-900/8">
      {rows.map((p) => {
        const current = p.startDate <= today && today <= p.endDate;
        const weekdays = countWeekdays(p.startDate, p.endDate);
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
            <div className="min-w-0 flex-1">
              <p className="tabular flex flex-wrap items-center gap-2 text-sm font-medium text-rex-950">
                {formatDateRange(p.startDate, p.endDate)}
                {current && <Badge tone="warning">Out now</Badge>}
              </p>
              <p className="text-xs text-ink-muted">
                {p.isPartialDay ? "Partial day" : `${weekdays} weekday${weekdays === 1 ? "" : "s"}`}
                {p.note && ` · ${p.note}`}
              </p>
            </div>
            <ConfirmDialog
              triggerVariant="ghost"
              triggerSize="sm"
              trigger={
                <>
                  <Trash2 aria-hidden="true" />
                  <span className="sr-only">Remove PTO {formatDateRange(p.startDate, p.endDate)}</span>
                </>
              }
              title="Remove this PTO?"
              description={formatDateRange(p.startDate, p.endDate)}
              confirmLabel="Remove"
              onConfirm={() => deletePtoAction(associateId, p.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}

function AddPtoForm({
  action,
  today,
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  today: string;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [state, formAction, pending] = useActionState<FormResult, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      setStart("");
      setEnd("");
    }
    return result;
  }, {});
  const e = state.errors ?? {};
  const singleDay = !!start && (!end || end === start);

  return (
    <Card className="h-fit">
      <CardHeader icon={<CalendarPlus />} title="Add PTO" />
      <form action={formAction} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startDate">First day</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={start}
              min={today}
              onChange={(ev) => {
                setStart(ev.target.value);
                if (!end || end < ev.target.value) setEnd(ev.target.value);
              }}
              aria-invalid={!!e.startDate}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">Last day</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={end}
              min={start || today}
              onChange={(ev) => setEnd(ev.target.value)}
              aria-invalid={!!e.endDate}
            />
          </div>
        </div>
        <FieldError message={e.startDate ?? e.endDate} />
        {start && end && end >= start && (
          <p className="text-xs text-ink-muted">
            {countWeekdays(start, end)} weekday{countWeekdays(start, end) === 1 ? "" : "s"}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isPartialDay"
            disabled={!singleDay}
            className="size-4 accent-rex-800 disabled:opacity-40"
          />
          Partial day
        </label>
        <FieldError message={e.isPartialDay} />
        <div>
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" name="note" maxLength={200} placeholder="e.g. Vacation" defaultValue={state.ok ? "" : state.values?.note} />
          <FieldError message={e.note} />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          <CalendarPlus aria-hidden="true" />
          {pending ? "Adding..." : "Add PTO"}
        </Button>
        {state.ok && state.message && <Alert tone="success">{state.message}</Alert>}
      </form>
    </Card>
  );
}
