"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, FieldHint, Label, Textarea } from "@/components/ui/input";
import { PROFICIENCY_LABELS } from "@/lib/associates/validation";
import type { FormResult } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Row = { id: number; name: string; description: string; proficiency: number };

export function CapabilityEditor({
  action,
  rows,
  notes,
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  rows: Row[];
  notes: string;
}) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-0">
        <div className="flex flex-wrap items-end justify-between gap-2 p-6 pb-4">
          <div>
            <h2 className="text-base font-semibold text-rex-950">Capability levels</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Matched against each client&apos;s needs when Rex recommends a team.
            </p>
          </div>
          <Link href="/settings#capabilities" className="text-sm text-rex-700 hover:text-rex-900">
            Edit the capability list
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-ink-muted">
            The capability list is empty. Add capabilities in Settings first.
          </p>
        ) : (
          <ul className="divide-y divide-rex-900/6 border-t border-rex-900/8">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p id={`cap-${row.id}-label`} className="text-sm font-medium text-rex-950">
                    {row.name}
                  </p>
                  {row.description && <p className="text-xs text-ink-muted">{row.description}</p>}
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby={`cap-${row.id}-label`}
                  className="inline-flex rounded-xl bg-rex-900/5 p-1"
                >
                  {PROFICIENCY_LABELS.map((label, level) => (
                    <label
                      key={label}
                      className={cn(
                        "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors select-none hover:text-rex-900",
                        "has-checked:bg-white has-checked:text-rex-900 has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-rex-500",
                        level === 3 && "has-checked:bg-rex-800 has-checked:text-white",
                      )}
                    >
                      <input
                        type="radio"
                        name={`cap_${row.id}`}
                        value={level}
                        defaultChecked={row.proficiency === level}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Label htmlFor="capabilityNotes">Capability notes</Label>
        <Textarea
          id="capabilityNotes"
          name="capabilityNotes"
          rows={5}
          defaultValue={notes}
          placeholder="Strengths, preferences and anything the levels don't capture, e.g. strong with restaurant clients, prefers smaller accounts while ramping up."
          aria-invalid={!!state.errors?.capabilityNotes}
        />
        <FieldError message={state.errors?.capabilityNotes} />
        <FieldHint className="flex items-center gap-1">
          <ShieldCheck className="size-3.5 text-rex-500" aria-hidden="true" />
          Claude reads these notes when recommending teams. Names and company codes are replaced with codes first.
        </FieldHint>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" />
          {pending ? "Saving..." : "Save capabilities"}
        </Button>
        {state.message && (
          <Alert tone={state.ok ? "success" : "error"} className="py-2">
            {state.message}
          </Alert>
        )}
      </div>
    </form>
  );
}
