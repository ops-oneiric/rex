"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint, Label, Textarea } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { savePrivacyAction } from "./actions";

export function PrivacyForm({ names }: { names: string[] }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(savePrivacyAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="extraNames">Other names to scrub</Label>
        <Textarea
          id="extraNames"
          name="extraNames"
          rows={5}
          defaultValue={names.join("\n")}
          placeholder={"One per line, e.g. a client's HR contact\nPat Example"}
        />
        <FieldHint>
          Associate names, client names and company codes are always replaced with codes. Add any other names that might
          appear in notes; they are sent as [NAME].
        </FieldHint>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        <Save aria-hidden="true" />
        {pending ? "Saving..." : "Save names"}
      </Button>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
