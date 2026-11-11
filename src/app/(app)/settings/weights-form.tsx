"use client";

import { useActionState, useState, useTransition } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeWeight, DEFAULT_WEIGHTS, type WeightSettings } from "@/lib/clients/weight";
import type { FormResult } from "@/lib/forms";
import { resetWeightsAction, saveWeightsAction } from "./actions";

type Field = { name: string; label: string };
const GROUPS: { title: string; fields: Field[] }[] = [
  { title: "Base", fields: [{ name: "base", label: "Every client" }] },
  {
    title: "Employees",
    fields: [
      { name: "employees50", label: "50-199" },
      { name: "employees200", label: "200-499" },
      { name: "employees500", label: "500+" },
    ],
  },
  {
    title: "Controls",
    fields: [
      { name: "perExtraControl", label: "Each control after the first" },
      { name: "controlCap", label: "Maximum for controls" },
    ],
  },
  { title: "Payroll complexity", fields: [1, 2, 3, 4, 5].map((i) => ({ name: `complexity${i}`, label: `Level ${i}` })) },
  {
    title: "Implementation type",
    fields: [
      { name: "newLogo", label: "New Logo" },
      { name: "addControl", label: "Add Control" },
    ],
  },
  {
    title: "Previous vendor",
    fields: [
      { name: "inHouse", label: "In-house" },
      { name: "newVendor", label: "New" },
    ],
  },
  { title: "Fast start", fields: [{ name: "fastStart", label: "Under 20 business days" }] },
];

function flatten(w: WeightSettings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(w)) {
    if (Array.isArray(v)) v.forEach((x, i) => (out[`complexity${i + 1}`] = String(x)));
    else out[k] = String(v);
  }
  return out;
}

function unflatten(f: Record<string, string>): WeightSettings {
  const n = (k: string) => Number(f[k]) || 0;
  return {
    base: n("base"),
    employees50: n("employees50"),
    employees200: n("employees200"),
    employees500: n("employees500"),
    perExtraControl: n("perExtraControl"),
    controlCap: n("controlCap"),
    complexity: [n("complexity1"), n("complexity2"), n("complexity3"), n("complexity4"), n("complexity5")],
    newLogo: n("newLogo"),
    addControl: n("addControl"),
    inHouse: n("inHouse"),
    newVendor: n("newVendor"),
    fastStart: n("fastStart"),
  };
}

export function WeightsForm({ current }: { current: WeightSettings }) {
  const [values, setValues] = useState(() => flatten(current));
  const [state, action, pending] = useActionState<FormResult, FormData>(saveWeightsAction, {});
  const [resetResult, setResetResult] = useState<FormResult | null>(null);
  const [resetting, startReset] = useTransition();
  const example = computeWeight(
    { employeeCount: 120, controlCount: 1, payrollComplexity: 3, implementationType: "NEW_LOGO", previousVendor: "IN_HOUSE" },
    false,
    unflatten(values),
  );
  const message = resetResult ?? state;

  return (
    <form action={action} className="space-y-5" onSubmit={() => setResetResult(null)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="rounded-xl bg-white/40 p-4 ring-1 ring-rex-900/8">
            <legend className="px-1 text-sm font-medium text-rex-950">{g.title}</legend>
            <div className="mt-1 space-y-2">
              {g.fields.map((f) => (
                <label key={f.name} className="flex items-center justify-between gap-3 text-sm text-ink">
                  <span>{f.label}</span>
                  <Input
                    name={f.name}
                    type="number"
                    inputMode="decimal"
                    step={0.05}
                    min={0}
                    max={5}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    className="tabular h-9 w-24 text-right"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        Example: 120 employees, 1 control, complexity 3, New Logo, previously in-house, normal start ={" "}
        <span className="tabular font-semibold text-rex-950">{example.total.toFixed(2)}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" />
          {pending ? "Saving..." : "Save weights"}
        </Button>
        <Button
          variant="ghost"
          disabled={resetting}
          onClick={() =>
            startReset(async () => {
              const result = await resetWeightsAction();
              if (result.ok) setValues(flatten(DEFAULT_WEIGHTS));
              setResetResult(result);
            })
          }
        >
          <RotateCcw aria-hidden="true" />
          Reset weights
        </Button>
      </div>
      {message.message && <Alert tone={message.ok ? "success" : "error"}>{message.message}</Alert>}
    </form>
  );
}
