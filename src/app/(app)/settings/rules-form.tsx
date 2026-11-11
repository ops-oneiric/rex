"use client";

import { useActionState, useState, useTransition } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_RULES, type RuleSettings } from "@/lib/assignments/rules";
import type { FormResult } from "@/lib/forms";
import { resetRulesAction, saveRulesAction } from "./actions";

type Key = keyof RuleSettings;
const GROUPS: { title: string; hint: string; fields: { key: Key; label: string; step: number }[] }[] = [
  {
    title: "PTO knock-out",
    hint: "Business days around first input. Payroll and hybrid seats are knocked out; PM seats are flagged.",
    fields: [
      { key: "ptoBefore", label: "Days before", step: 1 },
      { key: "ptoAfter", label: "Days after", step: 1 },
    ],
  },
  {
    title: "Benefits start",
    hint: "PTO within this many business days of benefits start is flagged.",
    fields: [{ key: "benefitsWindow", label: "Days either side", step: 1 }],
  },
  {
    title: "First input collisions",
    hint: "Business days between an associate's first inputs.",
    fields: [
      { key: "collisionConflict", label: "Conflict within", step: 1 },
      { key: "collisionClose", label: "Close within", step: 1 },
    ],
  },
  {
    title: "Seat shares",
    hint: "Fraction of a client's weight each seat carries. Hybrid is always 1.",
    fields: [
      { key: "shareTraditionalPm", label: "Traditional: PM", step: 0.05 },
      { key: "shareTraditionalPayroll", label: "Traditional: Payroll", step: 0.05 },
      { key: "sharePmModelPm", label: "PM model: PM", step: 0.05 },
      { key: "sharePmModelPayroll", label: "PM model: each Payroll", step: 0.05 },
    ],
  },
  {
    title: "Load bands",
    hint: "Below Healthy is Available.",
    fields: [
      { key: "bandHealthy", label: "Healthy from", step: 0.5 },
      { key: "bandFull", label: "Full above", step: 0.5 },
      { key: "bandOver", label: "Over above", step: 0.5 },
    ],
  },
  {
    title: "Time zones",
    hint: "Flag associates this many hours from the client.",
    fields: [{ key: "timeZoneFlagHours", label: "Hours apart", step: 1 }],
  },
];

const asStrings = (r: RuleSettings) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])) as Record<Key, string>;

export function RulesForm({ current }: { current: RuleSettings }) {
  const [values, setValues] = useState(() => asStrings(current));
  const [state, action, pending] = useActionState<FormResult, FormData>(saveRulesAction, {});
  const [resetResult, setResetResult] = useState<FormResult | null>(null);
  const [resetting, startReset] = useTransition();
  const num = (k: Key) => Number(values[k]) || 0;
  const traditional = num("shareTraditionalPm") + num("shareTraditionalPayroll");
  const pmModel = num("sharePmModelPm") + 2 * num("sharePmModelPayroll");
  const message = resetResult ?? state;

  return (
    <form action={action} className="space-y-5" onSubmit={() => setResetResult(null)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="rounded-xl bg-white/40 p-4 ring-1 ring-rex-900/8">
            <legend className="px-1 text-sm font-medium text-rex-950">{g.title}</legend>
            <p className="mb-2 text-xs text-ink-muted">{g.hint}</p>
            <div className="space-y-2">
              {g.fields.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3 text-sm text-ink">
                  <span>{f.label}</span>
                  <Input
                    name={f.key}
                    type="number"
                    inputMode="decimal"
                    step={f.step}
                    min={0}
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="tabular h-9 w-24 text-right"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {(Math.abs(traditional - 1) > 0.001 || Math.abs(pmModel - 1) > 0.001) && (
        <Alert tone="info">
          Seat shares add up to {traditional.toFixed(2)} for Traditional and {pmModel.toFixed(2)} for the PM model. That is
          allowed (for example, if a team carries more than one account&apos;s worth of work), but usually they add up to 1.
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" />
          {pending ? "Saving..." : "Save rules"}
        </Button>
        <Button
          variant="ghost"
          disabled={resetting}
          onClick={() =>
            startReset(async () => {
              const result = await resetRulesAction();
              if (result.ok) setValues(asStrings(DEFAULT_RULES));
              setResetResult(result);
            })
          }
        >
          <RotateCcw aria-hidden="true" />
          Reset rules
        </Button>
      </div>
      {message.message && <Alert tone={message.ok ? "success" : "error"}>{message.message}</Alert>}
    </form>
  );
}
