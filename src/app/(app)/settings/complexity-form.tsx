"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { FormResult } from "@/lib/forms";
import { saveComplexityScaleAction } from "./actions";

export function ComplexityScaleForm({ scale }: { scale: string[] }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(saveComplexityScaleAction, {});
  return (
    <form action={action} className="space-y-3">
      {scale.map((text, i) => (
        <label key={i} className="flex items-start gap-3">
          <span className="tabular mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-rex-100 text-sm font-semibold text-rex-800">
            {i + 1}
          </span>
          <span className="sr-only">Level {i + 1} description</span>
          <Textarea
            name={`level${i + 1}`}
            defaultValue={state.values?.[`level${i + 1}`] ?? text}
            maxLength={200}
            rows={2}
            className="min-h-0"
          />
        </label>
      ))}
      <Button type="submit" variant="secondary" disabled={pending}>
        <Save aria-hidden="true" />
        {pending ? "Saving..." : "Save scale"}
      </Button>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
    </form>
  );
}
