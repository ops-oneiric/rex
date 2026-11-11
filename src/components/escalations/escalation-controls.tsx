"use client";

import { useActionState, useState, useTransition } from "react";
import { CircleCheck, Loader2, Pencil, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import {
  deleteEscalationAction,
  reanalyzeEscalationAction,
  setEscalationStatusAction,
  updateDetailsAction,
} from "@/app/(app)/escalations/actions";

export function EscalationActions({ id, status }: { id: number; status: "OPEN" | "RESOLVED" }) {
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant={status === "OPEN" ? "primary" : "secondary"}
        disabled={pending}
        onClick={() => start(async () => void (await setEscalationStatusAction(id, status === "OPEN" ? "RESOLVED" : "OPEN")))}
      >
        {status === "OPEN" ? <CircleCheck aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
        {status === "OPEN" ? "Mark resolved" : "Reopen"}
      </Button>
      <ConfirmDialog
        trigger={
          <>
            <Trash2 aria-hidden="true" />
            Delete
          </>
        }
        title="Delete this escalation?"
        description="The details, the review and the action items created from it are removed. Trends will no longer count it."
        confirmLabel="Delete escalation"
        onConfirm={() => deleteEscalationAction(id)}
      />
    </>
  );
}

export function DetailsCard({
  id,
  occurredOn,
  details,
  analysis,
}: {
  id: number;
  occurredOn: string;
  details: string;
  analysis: { status: "PENDING" | "DONE" | "FAILED" | "NO_KEY"; stale: boolean; error: string | null };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [state, action, saving] = useActionState<FormResult, FormData>(async (prev, formData) => {
    const r = await updateDetailsAction(id, prev, formData);
    if (r.ok) setEditing(false);
    return r;
  }, {});
  const analyzing = analysis.status === "PENDING" && !analysis.stale;
  const retry = () => start(async () => void (await reanalyzeEscalationAction(id)));

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-rex-950">Details</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)} aria-label="Edit details">
            <Pencil aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" onClick={retry} disabled={pending || analyzing} aria-label="Analyze again" title="Analyze again">
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </div>
      {editing ? (
        <form action={action} className="space-y-3" noValidate>
          <div className="max-w-48">
            <Label htmlFor="e-date">Date</Label>
            <Input id="e-date" name="occurredOn" type="date" defaultValue={state.values?.occurredOn ?? occurredOn} />
            <FieldError message={state.errors?.occurredOn} />
          </div>
          <div>
            <Label htmlFor="e-details">Details</Label>
            <Textarea id="e-details" name="details" rows={7} defaultValue={state.values?.details ?? details} />
            <FieldError message={state.errors?.details} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-ink-muted">Changing the details asks Claude again. Your confirmed review is kept.</p>
        </form>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-ink">{details}</p>
      )}
      {analyzing && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Claude is reviewing the escalation...
        </p>
      )}
      {analysis.status === "PENDING" && analysis.stale && <Retry text="The analysis was interrupted." onRetry={retry} />}
      {analysis.status === "FAILED" && <Retry text={`The analysis failed: ${analysis.error}`} onRetry={retry} />}
      {analysis.status === "NO_KEY" && <Retry text="Save a Claude API key in Settings to get suggestions." onRetry={retry} label="Analyze now" />}
    </Card>
  );
}

function Retry({ text, onRetry, label = "Retry" }: { text: string; onRetry: () => void; label?: string }) {
  return (
    <Alert tone="info" className="mt-4">
      {text}{" "}
      <button type="button" className="font-medium underline" onClick={onRetry}>
        {label}
      </button>
    </Alert>
  );
}
