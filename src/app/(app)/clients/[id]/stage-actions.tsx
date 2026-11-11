"use client";

import Link from "next/link";
import { useActionState, useId, useRef } from "react";
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { STAGE_LABELS, STAGES, type Stage } from "@/lib/clients/constants";
import type { FormResult } from "@/lib/forms";
import { changeStageAction, deleteClientAction } from "../actions";

const consequences: Partial<Record<`${Stage}>${Stage}`, string>> = {
  "PROSPECT>IMPLEMENTATION": "The client joins your book of business. Any holds become the team and start counting toward capacity.",
  "IMPLEMENTATION>SERVICE": "The client leaves your book of business. Every team assignment ends today and stops counting toward capacity. History is kept.",
  "IMPLEMENTATION>PROSPECT": "The client returns to the pipeline. Its team stays as holds (projected load only).",
  "SERVICE>IMPLEMENTATION": "The client returns to your book of business. Its earlier team is not restored; assign a new one.",
};

export function ClientActions({
  id,
  label,
  stage,
  transitions,
}: {
  id: number;
  label: string;
  stage: Stage;
  transitions: Stage[];
}) {
  return (
    <>
      {transitions.map((to) => (
        <StageDialog key={to} id={id} from={stage} to={to} />
      ))}
      <Link
        href={`/clients/${id}/edit`}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/70 px-4 text-sm font-medium text-rex-900 ring-1 ring-rex-900/10 hover:bg-white"
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Link>
      <ConfirmDialog
        trigger={
          <>
            <Trash2 aria-hidden="true" />
            Delete
          </>
        }
        title={`Delete ${label}?`}
        description="This permanently removes the client and its stage history."
        confirmLabel="Delete client"
        onConfirm={() => deleteClientAction(id)}
      />
    </>
  );
}

function StageDialog({ id, from, to }: { id: number; from: Stage; to: Stage }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const forward = STAGES.indexOf(to) > STAGES.indexOf(from);
  const [state, action, pending] = useActionState<FormResult, FormData>(async (prev, formData) => {
    const result = await changeStageAction(id, to, prev, formData);
    if (result.ok) ref.current?.close();
    return result;
  }, {});
  const title = forward ? `Move to ${STAGE_LABELS[to]}` : `Move back to ${STAGE_LABELS[to]}`;

  return (
    <>
      <Button variant={forward ? "primary" : "secondary"} onClick={() => ref.current?.showModal()}>
        {forward ? <ArrowRight aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
        {title}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="glass m-auto w-[min(30rem,calc(100vw-2rem))] bg-white/90 p-0 text-ink backdrop:bg-rex-950/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <form action={action} className="space-y-4 p-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-rex-950">{title}?</h2>
            <p className="mt-1 text-sm text-ink-muted">{consequences[`${from}>${to}`]}</p>
          </div>
          {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
          <div>
            <Label htmlFor={`note-${to}`}>Note (optional)</Label>
            <Textarea id={`note-${to}`} name="note" rows={2} maxLength={500} placeholder="e.g. Contract signed" />
            <FieldError message={state.errors?.note} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => ref.current?.close()} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Moving..." : title}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
