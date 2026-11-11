"use client";

import { useState, useTransition } from "react";
import { DatabaseBackup, LogOut } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { backupNowAction, signOutOtherSessionsAction } from "./actions";

export function BackupNowButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(await backupNowAction());
          })
        }
      >
        <DatabaseBackup aria-hidden="true" />
        {pending ? "Backing up..." : "Back up now"}
      </Button>
      {result && <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert>}
    </div>
  );
}

export function SignOutOthersButton() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <ConfirmDialog
        trigger={
          <>
            <LogOut aria-hidden="true" />
            Sign out other browsers
          </>
        }
        triggerVariant="secondary"
        title="Sign out other browsers?"
        description="Every browser except this one will need your password again."
        confirmLabel="Sign them out"
        onConfirm={async () => {
          const result = await signOutOtherSessionsAction();
          setDone(result.message);
          return result;
        }}
      />
      {done && <Alert tone="success">{done}</Alert>}
    </div>
  );
}
