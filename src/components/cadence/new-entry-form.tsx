"use client";

import { useActionState } from "react";
import { NotebookPen, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { createEntryAction } from "@/app/(app)/cadence/actions";

/** The two inputs: when the 1:1 happened, and your notes. */
export function NewEntryForm({ associateId, today, hasKey }: { associateId: number; today: string; hasKey: boolean }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(createEntryAction.bind(null, associateId), {});
  const v = state.ok ? undefined : state.values;
  return (
    <Card id="new">
      <CardHeader icon={<NotebookPen />} title="Log a 1:1" />
      <form action={action} className="space-y-4" noValidate>
        <div className="max-w-48">
          <Label htmlFor="occurredOn">Date</Label>
          <Input id="occurredOn" name="occurredOn" type="date" defaultValue={v?.occurredOn ?? today} max={today} aria-invalid={!!state.errors?.occurredOn} />
          <FieldError message={state.errors?.occurredOn} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={8}
            defaultValue={v?.notes}
            placeholder="What you discussed, how they're doing, what was agreed. Write it however you like."
            aria-invalid={!!state.errors?.notes}
          />
          <FieldError message={state.errors?.notes} />
          <FieldHint>
            {hasKey
              ? "Claude reads your notes after you save and pulls out a summary, action items, strengths, growth areas, skills and morale. Notes are sent as written."
              : "Saved notes can be analyzed once a Claude API key is added in Settings."}
          </FieldHint>
        </div>
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" />
          {pending ? "Saving..." : "Save 1:1"}
        </Button>
        {state.ok && state.message && <Alert tone="success">{state.message}</Alert>}
        {!state.ok && state.message && <Alert tone="error">{state.message}</Alert>}
      </form>
    </Card>
  );
}
