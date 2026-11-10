"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { createCapabilityAction, deleteCapabilityAction, updateCapabilityAction } from "./actions";

type Capability = { id: number; name: string; description: string; usedBy: number };

export function CapabilityManager({ capabilities }: { capabilities: Capability[] }) {
  return (
    <div className="space-y-5">
      {capabilities.length === 0 ? (
        <p className="text-sm text-ink-muted">No capabilities yet. Add the first one below.</p>
      ) : (
        <ul className="divide-y divide-rex-900/6 rounded-xl bg-white/40 ring-1 ring-rex-900/8">
          {capabilities.map((c) => (
            <CapabilityRow key={c.id} capability={c} />
          ))}
        </ul>
      )}
      <AddCapabilityForm />
    </div>
  );
}

function CapabilityRow({ capability }: { capability: Capability }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<FormResult, FormData>(async (prev, formData) => {
    const result = await updateCapabilityAction(capability.id, prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});
  const e = state.errors ?? {};

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-[14rem_1fr_auto]">
          <div>
            <Input name="name" defaultValue={state.values?.name ?? capability.name} aria-label="Capability name" aria-invalid={!!e.name} autoFocus />
            <FieldError message={e.name} />
          </div>
          <div>
            <Input
              name="description"
              defaultValue={state.values?.description ?? capability.description}
              aria-label="Description"
              placeholder="Description (optional)"
              aria-invalid={!!e.description}
            />
            <FieldError message={e.description} />
          </div>
          <div className="flex gap-1">
            <Button type="submit" size="sm" disabled={pending} aria-label="Save capability" className="h-10">
              <Check aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel editing" className="h-10">
              <X aria-hidden="true" />
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-rex-950">{capability.name}</p>
        <p className="text-xs text-ink-muted">
          {capability.description || "No description"}
          {" · "}
          {capability.usedBy === 0 ? "Not used yet" : `${capability.usedBy} associate${capability.usedBy === 1 ? "" : "s"}`}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${capability.name}`}>
        <Pencil aria-hidden="true" />
      </Button>
      <ConfirmDialog
        triggerVariant="ghost"
        triggerSize="sm"
        trigger={
          <>
            <Trash2 aria-hidden="true" />
            <span className="sr-only">Delete {capability.name}</span>
          </>
        }
        title={`Delete "${capability.name}"?`}
        description={
          capability.usedBy > 0
            ? `It is set on ${capability.usedBy} associate${capability.usedBy === 1 ? "" : "s"}, and their level for it will be removed too.`
            : "No associates use it yet."
        }
        confirmLabel="Delete capability"
        onConfirm={() => deleteCapabilityAction(capability.id)}
      />
    </li>
  );
}

function AddCapabilityForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(createCapabilityAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="newCapabilityName">New capability</Label>
        <Input id="newCapabilityName" name="name" defaultValue={state.ok ? "" : state.values?.name} aria-invalid={!!e.name} />
        <FieldError message={e.name} />
      </div>
      <div>
        <Label htmlFor="newCapabilityDescription">Description</Label>
        <Input
          id="newCapabilityDescription"
          name="description"
          placeholder="Optional"
          defaultValue={state.ok ? "" : state.values?.description}
          aria-invalid={!!e.description}
        />
        <FieldError message={e.description} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Plus aria-hidden="true" />
        Add capability
      </Button>
      {state.ok && state.message && (
        <Alert tone="success" className="sm:col-span-3">
          {state.message}
        </Alert>
      )}
    </form>
  );
}
