"use client";

import { UserMinus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { unassignAction } from "../../assign/actions";

export function UnassignButton({ assignmentId, name }: { assignmentId: number; name: string }) {
  return (
    <ConfirmDialog
      triggerVariant="ghost"
      triggerSize="sm"
      trigger={
        <>
          <UserMinus aria-hidden="true" />
          <span className="sr-only">Unassign {name}</span>
        </>
      }
      title={`Unassign ${name}?`}
      description="The seat becomes unfilled. Their time on this client stays in the history, unless they were assigned today."
      confirmLabel="Unassign"
      onConfirm={() => unassignAction(assignmentId)}
    />
  );
}
