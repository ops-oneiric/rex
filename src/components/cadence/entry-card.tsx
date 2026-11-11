"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import type { Insight } from "@/lib/ai/cadence/core";
import { formatDate } from "@/lib/dates";
import type { FormResult } from "@/lib/forms";
import { deleteEntryAction, reanalyzeAction, setItemStatusAction, updateEntryAction } from "@/app/(app)/cadence/actions";
import { ActionItemList, type ItemView } from "./action-items";

export type EntryView = {
  id: number;
  occurredOn: string;
  notes: string;
  analysisStatus: "PENDING" | "DONE" | "FAILED" | "NO_KEY";
  analysisError: string | null;
  insight: Insight | null;
  stale: boolean;
};

const MORALE = {
  positive: { tone: "success", label: "Positive" },
  neutral: { tone: "neutral", label: "Neutral" },
  concerned: { tone: "warning", label: "Concerned" },
} as const;

const FOLLOW_UP = { done: "looks done", still_open: "still open", no_longer_relevant: "no longer relevant" } as const;

export function EntryCard({ entry, items, openItems }: { entry: EntryView; items: ItemView[]; openItems: ItemView[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const insight = entry.insight;
  const analyzing = entry.analysisStatus === "PENDING" && !entry.stale;

  return (
    <Card role="article" className="p-0" aria-label={`1:1 on ${formatDate(entry.occurredOn)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rex-900/8 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-rex-950">{formatDate(entry.occurredOn, { withWeekday: true })}</h3>
          {insight && entry.analysisStatus === "DONE" && (
            <Badge tone={MORALE[insight.morale.level].tone} title={insight.morale.reason}>
              Morale: {MORALE[insight.morale.level].label}
            </Badge>
          )}
          {insight?.themes.map((t) => (
            <Badge key={t} tone="primary">{t}</Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)} aria-label="Edit notes">
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || analyzing}
            onClick={() => start(async () => void (await reanalyzeAction(entry.id)))}
            aria-label="Analyze again"
            title="Analyze again"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
          <ConfirmDialog
            triggerVariant="ghost"
            triggerSize="sm"
            trigger={
              <>
                <Trash2 aria-hidden="true" />
                <span className="sr-only">Delete this 1:1</span>
              </>
            }
            title="Delete this 1:1?"
            description="The notes, Claude's insight and the action items from this meeting are removed."
            confirmLabel="Delete"
            onConfirm={() => deleteEntryAction(entry.id)}
          />
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {editing && <EditForm entry={entry} onDone={() => setEditing(false)} />}

        {analyzing && (
          <p className="flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Claude is reading your notes...
          </p>
        )}
        {entry.analysisStatus === "PENDING" && entry.stale && (
          <RetryNote text="The analysis was interrupted." entryId={entry.id} />
        )}
        {entry.analysisStatus === "FAILED" && <RetryNote text={`The analysis failed: ${entry.analysisError}`} entryId={entry.id} />}
        {entry.analysisStatus === "NO_KEY" && (
          <RetryNote text="Save a Claude API key in Settings to get insights from your notes." entryId={entry.id} label="Analyze now" />
        )}

        {insight && entry.analysisStatus === "DONE" && (
          <>
            <p className="text-sm text-ink">{insight.summary}</p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <List title="Strengths" items={insight.strengths} empty="None noted." />
              <List title="Growth areas" items={insight.weak_points} empty="None noted." />
            </div>
            {insight.skills.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">Skills shown</h4>
                <div className="flex flex-wrap gap-1.5">
                  {insight.skills.map((s) => (
                    <Badge key={s.skill} tone={s.capability ? "primary" : "neutral"} title={s.capability ? `Capability: ${s.capability}` : undefined}>
                      {s.skill}
                      {s.capability && s.capability.toLowerCase() !== s.skill.toLowerCase() && ` (${s.capability})`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="mb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">Action items from this 1:1</h4>
              <ActionItemList items={items} emptyText="None from this meeting." />
            </div>
            {insight.follow_ups.length > 0 && <FollowUps followUps={insight.follow_ups} openItems={openItems} />}
            <p className="text-xs text-ink-muted">Morale: {insight.morale.reason}</p>
          </>
        )}

        <details>
          <summary className="cursor-pointer text-sm font-medium text-rex-700 select-none">Your notes</summary>
          <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{entry.notes}</p>
        </details>
      </div>
    </Card>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">{title}</h4>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-4 text-sm text-ink">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

function FollowUps({ followUps, openItems }: { followUps: Insight["follow_ups"]; openItems: ItemView[] }) {
  const [pending, start] = useTransition();
  const relevant = followUps
    .map((f) => ({ ...f, item: openItems.find((i) => i.id === f.item_id) }))
    .filter((f) => f.item);
  if (!relevant.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">Earlier action items</h4>
      <ul className="space-y-2">
        {relevant.map((f) => (
          <li key={f.item_id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white/50 px-3 py-2 text-sm ring-1 ring-rex-900/8">
            <span className="min-w-0 flex-1">
              <span className="text-ink">{f.item!.text}</span>
              <span className="text-ink-muted"> {FOLLOW_UP[f.status]}: {f.evidence}</span>
            </span>
            {f.status !== "still_open" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => start(async () => void (await setItemStatusAction(f.item_id, f.status === "done" ? "DONE" : "DROPPED")))}
              >
                <Check aria-hidden="true" />
                {f.status === "done" ? "Mark done" : "Drop it"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RetryNote({ text, entryId, label = "Retry" }: { text: string; entryId: number; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Alert tone="info">
      {text}{" "}
      <button
        type="button"
        disabled={pending}
        className="font-medium underline"
        onClick={() => start(async () => void (await reanalyzeAction(entryId)))}
      >
        {label}
      </button>
    </Alert>
  );
}

function EditForm({ entry, onDone }: { entry: EntryView; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(async (prev, formData) => {
    const result = await updateEntryAction(entry.id, prev, formData);
    if (result.ok) onDone();
    return result;
  }, {});
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white/50 p-4 ring-1 ring-rex-900/8" noValidate>
      <div className="max-w-48">
        <Label htmlFor={`date-${entry.id}`}>Date</Label>
        <Input id={`date-${entry.id}`} name="occurredOn" type="date" defaultValue={state.values?.occurredOn ?? entry.occurredOn} />
        <FieldError message={state.errors?.occurredOn} />
      </div>
      <div>
        <Label htmlFor={`notes-${entry.id}`}>Notes</Label>
        <Textarea id={`notes-${entry.id}`} name="notes" rows={8} defaultValue={state.values?.notes ?? entry.notes} />
        <FieldError message={state.errors?.notes} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-ink-muted">Changing the notes runs the analysis again. Action items you have edited or completed are kept.</p>
    </form>
  );
}
