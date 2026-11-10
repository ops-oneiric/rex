"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banknote, CalendarCheck, ClipboardList, Save, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckboxTile, FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { TimeZoneSelect } from "@/components/ui/time-zone-select";
import type { FormResult } from "@/lib/forms";

export type AssociateFormValues = {
  name: string;
  email: string;
  title: string;
  timeZone: string;
  canPm: boolean;
  canPayroll: boolean;
  targetLoad: string;
  isDirectlyManaged: boolean;
};

export function AssociateForm({
  action,
  initial,
  otherZones,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  initial: AssociateFormValues;
  otherZones: string[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(action, {});
  const e = state.errors ?? {};
  const v = state.values;
  // After a failed submit, show what was typed; checkboxes are absent from FormData when unchecked.
  const text = (key: keyof AssociateFormValues) => (v ? (v[key] ?? "") : String(initial[key]));
  const checked = (key: keyof AssociateFormValues) => (v ? key in v : Boolean(initial[key]));
  const describedBy = (key: string) => (e[key] ? `${key}-error` : undefined);

  return (
    <form action={formAction} className="max-w-3xl space-y-6" noValidate>
      {Object.keys(e).length > 0 && <Alert tone="error">Please fix the highlighted fields.</Alert>}

      <Card>
        <h2 className="mb-4 text-base font-semibold text-rex-950">Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={text("name")}
              autoComplete="off"
              aria-invalid={!!e.name}
              aria-describedby={describedBy("name") ?? "name-hint"}
              required
              autoFocus={!initial.name}
            />
            <FieldError id="name-error" message={e.name} />
            {!e.name && (
              <FieldHint id="name-hint" className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-rex-500" aria-hidden="true" />
                Names are never sent to Claude. Rex replaces them with codes first.
              </FieldHint>
            )}
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={text("title")}
              placeholder="e.g. Senior Implementation Specialist"
              aria-invalid={!!e.title}
              aria-describedby={describedBy("title")}
            />
            <FieldError id="title-error" message={e.title} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={text("email")}
              autoComplete="off"
              aria-invalid={!!e.email}
              aria-describedby={describedBy("email")}
            />
            <FieldError id="email-error" message={e.email} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="timeZone">Time zone</Label>
            <TimeZoneSelect
              id="timeZone"
              name="timeZone"
              defaultValue={text("timeZone")}
              otherZones={otherZones}
              aria-invalid={!!e.timeZone}
              aria-describedby={describedBy("timeZone")}
            />
            <FieldError id="timeZone-error" message={e.timeZone} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-rex-950">Seats and workload</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Which seats this associate can fill. Associates who can do both are eligible for Hybrid accounts.
        </p>
        <fieldset aria-describedby={describedBy("seats")}>
          <legend className="sr-only">Seats</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CheckboxTile
              name="canPm"
              label="PM"
              hint="Project management seat"
              icon={<ClipboardList />}
              defaultChecked={checked("canPm")}
              invalid={!!e.seats}
            />
            <CheckboxTile
              name="canPayroll"
              label="Payroll"
              hint="Payroll seat. PTO knock-out rules apply."
              icon={<Banknote />}
              defaultChecked={checked("canPayroll")}
              invalid={!!e.seats}
            />
          </div>
          <FieldError id="seats-error" message={e.seats} />
        </fieldset>

        <div className="mt-5 max-w-xs">
          <Label htmlFor="targetLoad">Target load</Label>
          <Input
            id="targetLoad"
            name="targetLoad"
            type="number"
            inputMode="decimal"
            min={1}
            max={15}
            step={0.5}
            defaultValue={text("targetLoad")}
            className="tabular"
            aria-invalid={!!e.targetLoad}
            aria-describedby={describedBy("targetLoad") ?? "targetLoad-hint"}
          />
          <FieldError id="targetLoad-error" message={e.targetLoad} />
          {!e.targetLoad && (
            <FieldHint id="targetLoad-hint">
              Weighted units, where a typical account is about 1. Your healthy band is 5 to 10.
            </FieldHint>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-rex-950">Cadence</h2>
        <CheckboxTile
          name="isDirectlyManaged"
          label="I manage this associate directly"
          hint="Shows them in Cadence so you can log 1:1 notes."
          icon={<CalendarCheck />}
          defaultChecked={checked("isDirectlyManaged")}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" />
          {pending ? "Saving..." : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-rex-800 hover:bg-rex-900/5"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
