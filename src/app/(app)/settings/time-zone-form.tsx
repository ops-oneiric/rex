"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint, Label } from "@/components/ui/input";
import { TimeZoneSelect } from "@/components/ui/time-zone-select";
import { saveTimeZoneAction, type FormState } from "./actions";

export function TimeZoneForm({ current, otherZones }: { current: string; otherZones: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTimeZoneAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="homeTimeZone">Your time zone</Label>
        <TimeZoneSelect id="homeTimeZone" name="timeZone" defaultValue={current} otherZones={otherZones} />
        <FieldHint>Decides what &ldquo;today&rdquo; means in Rex, for example which PTO is current.</FieldHint>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Save aria-hidden="true" />
        {pending ? "Saving..." : "Save time zone"}
      </Button>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
