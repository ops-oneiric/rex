"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Select } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { addItemAction, deleteItemAction, setItemStatusAction, updateItemAction } from "@/app/(app)/cadence/actions";

export type ItemView = {
  id: number;
  text: string;
  owner: "ME" | "ASSOCIATE";
  dueHint: string | null;
  status: "OPEN" | "DONE" | "DROPPED";
  sourceDate?: string | null;
  associateName?: string | null;
};

export function ActionItemList({ items, showAssociate, emptyText }: { items: ItemView[]; showAssociate?: boolean; emptyText?: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{emptyText ?? "No action items."}</p>;
  return (
    <ul className="divide-y divide-rex-900/6">
      {items.map((item) => (
        <ActionItemRow key={item.id} item={item} showAssociate={showAssociate} />
      ))}
    </ul>
  );
}

function ActionItemRow({ item, showAssociate }: { item: ItemView; showAssociate?: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [owner, setOwner] = useState(item.owner);
  const [error, setError] = useState<string | null>(null);
  // Show the new status immediately; it settles to the saved value when the server answers.
  const [status, setOptimisticStatus] = useOptimistic(item.status);
  const done = status === "DONE";
  const dropped = status === "DROPPED";
  const changeStatus = (next: ItemView["status"]) =>
    start(async () => {
      setOptimisticStatus(next);
      await setItemStatusAction(item.id, next);
    });

  if (editing) {
    return (
      <li className="space-y-2 py-2.5">
        <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Action item" maxLength={300} autoFocus />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={owner} onChange={(e) => setOwner(e.target.value as ItemView["owner"])} aria-label="Owner" className="h-9 w-auto">
            <option value="ME">You</option>
            <option value="ASSOCIATE">Associate</option>
          </Select>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateItemAction(item.id, { text, owner });
                if (r.ok) setEditing(false);
                else setError(r.message ?? "Could not save.");
              })
            }
          >
            <Check aria-hidden="true" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        <FieldError message={error ?? undefined} />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        disabled={pending || dropped}
        onChange={() => changeStatus(done ? "OPEN" : "DONE")}
        aria-label={`${done ? "Reopen" : "Mark done"}: ${item.text}`}
        className="mt-0.5 size-4 shrink-0 accent-rex-800"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-ink", (done || dropped) && "text-ink-muted line-through decoration-rex-300")}>{item.text}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <Badge tone={item.owner === "ME" ? "primary" : "neutral"}>{item.owner === "ME" ? "You" : "Associate"}</Badge>
          {showAssociate && item.associateName && <span>{item.associateName}</span>}
          {item.dueHint && <span>Due: {item.dueHint}</span>}
          {item.sourceDate && <span>From 1:1 on {item.sourceDate}</span>}
          {dropped && <span>Dropped</span>}
        </div>
      </div>
      <div className="flex shrink-0 opacity-70 group-hover:opacity-100">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit: ${item.text}`}>
          <Pencil aria-hidden="true" />
        </Button>
        {status === "OPEN" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => changeStatus("DROPPED")}
            aria-label={`Drop: ${item.text}`}
            title="No longer needed"
          >
            <X aria-hidden="true" />
          </Button>
        ) : dropped ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => changeStatus("OPEN")}
            aria-label={`Reopen: ${item.text}`}
          >
            <Undo2 aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => start(async () => void (await deleteItemAction(item.id)))}
          aria-label={`Delete: ${item.text}`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export function AddItemForm({ associateId }: { associateId: number }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(addItemAction.bind(null, associateId), {});
  return (
    <form action={action} className="mt-3 flex flex-wrap items-start gap-2">
      <div className="min-w-40 flex-1">
        <Input name="text" placeholder="Add an action item" aria-label="New action item" maxLength={300} defaultValue={state.ok ? "" : state.values?.text} />
        <FieldError message={state.errors?.text} />
      </div>
      <Select name="owner" aria-label="Owner of the new item" className="h-10 w-auto" defaultValue="ME">
        <option value="ME">You</option>
        <option value="ASSOCIATE">Associate</option>
      </Select>
      <Button type="submit" variant="secondary" disabled={pending} aria-label="Add action item">
        <Plus aria-hidden="true" />
      </Button>
    </form>
  );
}
