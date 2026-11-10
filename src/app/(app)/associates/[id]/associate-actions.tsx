"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAssociateAction, setAssociateActiveAction } from "../actions";

export function AssociateActions({ id, name, isActive }: { id: number; name: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <>
      <Link
        href={`/associates/${id}/edit`}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/70 px-4 text-sm font-medium text-rex-900 ring-1 ring-rex-900/10 hover:bg-white"
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Link>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => start(() => setAssociateActiveAction(id, !isActive))}
        title={isActive ? "Hide from recommendations but keep history" : "Make available for recommendations again"}
      >
        {isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>
      <ConfirmDialog
        trigger={
          <>
            <Trash2 aria-hidden="true" />
            Delete
          </>
        }
        title={`Delete ${name}?`}
        description={
          <>
            This permanently removes {name} with their capabilities and PTO. If they have only left for now, use{" "}
            <strong>Deactivate</strong> instead to keep their history.
          </>
        }
        confirmLabel="Delete associate"
        onConfirm={() => deleteAssociateAction(id)}
      />
    </>
  );
}
