"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Eye, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { createEscalationAction, previewEscalationAction } from "@/app/(app)/escalations/actions";

/** The two inputs: when it happened, and what happened. */
export function NewEscalationForm({ today, hasKey }: { today: string; hasKey: boolean }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(createEscalationAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const v = state.values;

  const showPreview = () =>
    startPreview(async () => {
      const fd = new FormData(formRef.current!);
      const r = await previewEscalationAction(String(fd.get("occurredOn") ?? ""), String(fd.get("details") ?? ""));
      setPreview(r.ok ? (r.payload ?? "") : (r.message ?? "Preview unavailable."));
    });

  return (
    <Card>
      <CardHeader icon={<TriangleAlert />} title="Log an escalation" />
      <form ref={formRef} action={action} className="space-y-4" noValidate>
        <div className="max-w-48">
          <Label htmlFor="occurredOn">Date</Label>
          <Input id="occurredOn" name="occurredOn" type="date" defaultValue={v?.occurredOn ?? today} aria-invalid={!!state.errors?.occurredOn} />
          <FieldError message={state.errors?.occurredOn} />
        </div>
        <div>
          <Label htmlFor="details">Details</Label>
          <Textarea
            id="details"
            name="details"
            rows={7}
            defaultValue={v?.details}
            placeholder="What happened, who was involved, what the client said, and what has been done so far."
            aria-invalid={!!state.errors?.details}
            onChange={() => setPreview(null)}
          />
          <FieldError message={state.errors?.details} />
          <FieldHint className="flex items-start gap-1">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-rex-500" aria-hidden="true" />
            {hasKey
              ? "Claude reviews it after you save and proposes the client, the people involved, category, severity, fault and root cause for you to confirm. Names, company codes, emails and phone numbers are replaced first."
              : "Saved escalations can be analyzed once a Claude API key is added in Settings."}
          </FieldHint>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <Save aria-hidden="true" />
            {pending ? "Saving..." : "Save escalation"}
          </Button>
          {hasKey && (
            <Button variant="ghost" disabled={previewing} onClick={showPreview}>
              <Eye aria-hidden="true" />
              {previewing ? "Building preview..." : "Preview what will be sent"}
            </Button>
          )}
        </div>
        {!state.ok && state.message && <Alert tone="error">{state.message}</Alert>}
        {preview !== null && (
          <pre
            aria-label="What Claude will receive"
            className="max-h-80 overflow-auto rounded-xl bg-rex-950/90 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-rex-50"
          >
            {preview}
          </pre>
        )}
      </form>
    </Card>
  );
}
