"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { saveCadenceDaysAction } from "./actions";

export function CadenceForm({ days }: { days: number }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveCadenceDaysAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="max-w-40">
        <Label htmlFor="cadenceDays">1:1 every (days)</Label>
        <Input id="cadenceDays" name="cadenceDays" type="number" min={1} max={90} defaultValue={days} className="tabular" />
      </div>
      <FieldHint>A 1:1 shows as due soon three days before this and overdue after it. 14 is every two weeks.</FieldHint>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Save aria-hidden="true" />
        {pending ? "Saving..." : "Save rhythm"}
      </Button>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
