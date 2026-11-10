"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Save, Scale, ShieldCheck, Zap } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import { RadioTiles } from "@/components/ui/radio-tiles";
import { TimeZoneSelect } from "@/components/ui/time-zone-select";
import { isFastStart } from "@/lib/business-days";
import {
  IMPLEMENTATION_TYPE_LABELS,
  IMPLEMENTATION_TYPES,
  PREVIOUS_VENDOR_LABELS,
  PREVIOUS_VENDORS,
  SUPPORT_MODEL_LABELS,
  SUPPORT_MODEL_SEATS,
  SUPPORT_MODELS,
  type Stage,
} from "@/lib/clients/constants";
import { computeWeight, type WeightSettings } from "@/lib/clients/weight";
import { isIsoDate } from "@/lib/dates";
import type { FormResult } from "@/lib/forms";

export type ClientFormValues = Record<
  | "companyCode"
  | "displayName"
  | "implementationType"
  | "supportModel"
  | "employeeCount"
  | "firstInputDate"
  | "benefitsStartDate"
  | "timeZone"
  | "controlCount"
  | "payrollComplexity"
  | "previousVendor"
  | "notes",
  string
>;

type Props = {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  initial: ClientFormValues;
  /** Fixed stage when editing; undefined when creating (the form offers a choice). */
  stage?: Stage;
  otherZones: string[];
  complexityScale: string[];
  weights: WeightSettings;
  today: string;
  holidays: string[];
  submitLabel: string;
  cancelHref: string;
};

const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

export function ClientForm(props: Props) {
  const { action, initial, otherZones, complexityScale, weights, today, holidays, submitLabel, cancelHref } = props;
  const [state, formAction, pending] = useActionState<FormResult, FormData>(action, {});
  const e = state.errors ?? {};
  const v = (state.values ?? initial) as Partial<Record<string, string>>;
  const val = (k: keyof ClientFormValues | "lifecycleStage") => v[k] ?? "";

  const [stage, setStage] = useState<Stage>(props.stage ?? ((v.lifecycleStage as Stage) || "PROSPECT"));
  const [live, setLive] = useState<Record<string, string>>(() => ({ ...initial, ...(state.values ?? {}) }));
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const required = stage !== "PROSPECT";

  const preview = useMemo(() => {
    const fid = isIsoDate(live.firstInputDate ?? "") ? live.firstInputDate! : null;
    const fast = fid ? isFastStart(today, fid, holidaySet) : false;
    const weight = computeWeight(
      {
        employeeCount: num(live.employeeCount),
        controlCount: num(live.controlCount),
        payrollComplexity: num(live.payrollComplexity),
        implementationType: (live.implementationType || null) as never,
        previousVendor: (live.previousVendor || null) as never,
      },
      fast,
      weights,
    );
    return { fid, fast, weight };
  }, [live, today, holidaySet, weights]);

  const req = required ? <Badge tone="neutral" className="ml-1.5 align-middle">Required</Badge> : null;
  const describedBy = (key: string) => (e[key] ? `${key}-error` : undefined);

  return (
    <form
      action={formAction}
      onChange={(ev) => {
        const fd = new FormData(ev.currentTarget);
        setLive(Object.fromEntries([...fd.entries()].map(([k, x]) => [k, String(x)])));
      }}
      className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_18rem]"
      noValidate
    >
      <div className="min-w-0 space-y-6">
        {Object.keys(e).length > 0 && <Alert tone="error">Please fix the highlighted fields.</Alert>}

        <Card>
          <h2 className="mb-4 text-base font-semibold text-rex-950">Client</h2>
          {!props.stage && (
            <div className="mb-5">
              <p id="stage-label" className="mb-1.5 text-sm font-medium text-rex-950">Stage</p>
              <div role="radiogroup" aria-labelledby="stage-label" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ["PROSPECT", "Prospect", "In the pipeline. Fill details in as you learn them."],
                    ["IMPLEMENTATION", "Implementation", "Signed and on your book of business."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-white/60 p-3 ring-1 ring-rex-900/10 has-checked:bg-rex-50 has-checked:ring-2 has-checked:ring-rex-500 has-focus-visible:ring-2 has-focus-visible:ring-rex-500"
                  >
                    <input
                      type="radio"
                      name="lifecycleStage"
                      value={value}
                      checked={stage === value}
                      onChange={() => setStage(value)}
                      className="mt-0.5 size-4 accent-rex-800"
                    />
                    <span>
                      <span className="block text-sm font-medium text-rex-950">{label}</span>
                      <span className="block text-xs text-ink-muted">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_1fr]">
            <div>
              <Label htmlFor="companyCode">Company code{req}</Label>
              <Input
                id="companyCode"
                name="companyCode"
                defaultValue={val("companyCode")}
                maxLength={3}
                autoComplete="off"
                spellCheck={false}
                className="font-mono tracking-[0.3em] uppercase"
                aria-invalid={!!e.companyCode}
                aria-describedby={describedBy("companyCode")}
                autoFocus={!initial.companyCode}
              />
            </div>
            <div>
              <Label htmlFor="displayName">Name (optional)</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={val("displayName")}
                autoComplete="off"
                aria-invalid={!!e.displayName}
                aria-describedby={describedBy("displayName")}
              />
            </div>
          </div>
          <FieldError id="companyCode-error" message={e.companyCode} />
          <FieldError id="displayName-error" message={e.displayName} />
          <FieldHint className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-rex-500" aria-hidden="true" />
            Company codes and names are never sent to Claude. Rex replaces them with codes first.
          </FieldHint>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-rex-950">Implementation</h2>
          <div className="space-y-5">
            <div>
              <p id="supportModel-label" className="mb-1.5 text-sm font-medium text-rex-950">Support model{req}</p>
              <RadioTiles
                name="supportModel"
                labelledBy="supportModel-label"
                describedBy={describedBy("supportModel")}
                defaultValue={val("supportModel")}
                invalid={!!e.supportModel}
                unsetLabel={required ? undefined : "Decide later"}
                columns={required ? 3 : 4}
                options={SUPPORT_MODELS.map((m) => ({ value: m, label: SUPPORT_MODEL_LABELS[m], hint: SUPPORT_MODEL_SEATS[m] }))}
              />
              <FieldError id="supportModel-error" message={e.supportModel} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="implementationType">Implementation type{req}</Label>
                <Select
                  id="implementationType"
                  name="implementationType"
                  defaultValue={val("implementationType")}
                  aria-invalid={!!e.implementationType}
                  aria-describedby={describedBy("implementationType")}
                >
                  <option value="">Not set</option>
                  {IMPLEMENTATION_TYPES.map((t) => (
                    <option key={t} value={t}>{IMPLEMENTATION_TYPE_LABELS[t]}</option>
                  ))}
                </Select>
                <FieldError id="implementationType-error" message={e.implementationType} />
              </div>
              <div>
                <Label htmlFor="previousVendor">Previous vendor{req}</Label>
                <Select
                  id="previousVendor"
                  name="previousVendor"
                  defaultValue={val("previousVendor")}
                  aria-invalid={!!e.previousVendor}
                  aria-describedby={describedBy("previousVendor")}
                >
                  <option value="">Not set</option>
                  {PREVIOUS_VENDORS.map((p) => (
                    <option key={p} value={p}>{PREVIOUS_VENDOR_LABELS[p]}</option>
                  ))}
                </Select>
                <FieldError id="previousVendor-error" message={e.previousVendor} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-rex-950">Size and complexity</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="employeeCount">Employee count{req}</Label>
              <Input
                id="employeeCount"
                name="employeeCount"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={val("employeeCount")}
                className="tabular"
                aria-invalid={!!e.employeeCount}
                aria-describedby={describedBy("employeeCount")}
              />
              <FieldError id="employeeCount-error" message={e.employeeCount} />
            </div>
            <div>
              <Label htmlFor="controlCount">Control count{req}</Label>
              <Input
                id="controlCount"
                name="controlCount"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={val("controlCount")}
                className="tabular"
                aria-invalid={!!e.controlCount}
                aria-describedby={describedBy("controlCount") ?? "controlCount-hint"}
              />
              <FieldError id="controlCount-error" message={e.controlCount} />
              {!e.controlCount && <FieldHint id="controlCount-hint">Number of companies.</FieldHint>}
            </div>
          </div>
          <div className="mt-5">
            <p id="payrollComplexity-label" className="mb-1.5 text-sm font-medium text-rex-950">Payroll complexity{req}</p>
            <RadioTiles
              name="payrollComplexity"
              labelledBy="payrollComplexity-label"
              describedBy={describedBy("payrollComplexity")}
              defaultValue={val("payrollComplexity")}
              invalid={!!e.payrollComplexity}
              unsetLabel={required ? undefined : "Not set"}
              columns={2}
              options={complexityScale.map((hint, i) => ({ value: String(i + 1), label: String(i + 1), hint }))}
            />
            <FieldError id="payrollComplexity-error" message={e.payrollComplexity} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-rex-950">Dates and location</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstInputDate">First input date{req}</Label>
              <Input
                id="firstInputDate"
                name="firstInputDate"
                type="date"
                defaultValue={val("firstInputDate")}
                aria-invalid={!!e.firstInputDate}
                aria-describedby={describedBy("firstInputDate") ?? "firstInputDate-hint"}
              />
              <FieldError id="firstInputDate-error" message={e.firstInputDate} />
              {!e.firstInputDate && <FieldHint id="firstInputDate-hint">The first payroll (go-live).</FieldHint>}
            </div>
            <div>
              <Label htmlFor="benefitsStartDate">Benefits start date (optional)</Label>
              <Input
                id="benefitsStartDate"
                name="benefitsStartDate"
                type="date"
                defaultValue={val("benefitsStartDate")}
                aria-invalid={!!e.benefitsStartDate}
                aria-describedby={describedBy("benefitsStartDate")}
              />
              <FieldError id="benefitsStartDate-error" message={e.benefitsStartDate} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="timeZone">Time zone{req}</Label>
              <TimeZoneSelect
                id="timeZone"
                name="timeZone"
                defaultValue={val("timeZone")}
                otherZones={otherZones}
                aria-invalid={!!e.timeZone}
                aria-describedby={describedBy("timeZone")}
              />
              <FieldError id="timeZone-error" message={e.timeZone} />
            </div>
          </div>
        </Card>

        <Card>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" name="notes" rows={4} defaultValue={val("notes")} aria-invalid={!!e.notes} />
          <FieldError message={e.notes} />
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <Save aria-hidden="true" />
            {pending ? "Saving..." : submitLabel}
          </Button>
          <Link
            href={cancelHref}
            className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-rex-800 hover:bg-rex-900/5"
          >
            Cancel
          </Link>
        </div>
      </div>

      <aside className="xl:sticky xl:top-8 xl:h-fit" aria-live="polite" aria-label="Workload weight preview">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-rex-950">
            <Scale className="size-4 text-rex-600" aria-hidden="true" />
            Workload weight
          </div>
          <p className="tabular mt-2 text-3xl font-semibold text-rex-950">
            {preview.weight.total.toFixed(2)}
            {preview.weight.incomplete && <span className="ml-1 text-base font-normal text-ink-muted">so far</span>}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-ink-muted">
            {preview.weight.parts.map((p) => (
              <li key={p.label} className="flex justify-between gap-2">
                <span>{p.label}</span>
                <span className="tabular">+{p.value.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          {preview.fid && preview.fast && (
            <Badge tone="warning" className="mt-4">
              <Zap aria-hidden="true" />
              Fast start if assigned today
            </Badge>
          )}
          <p className="mt-3 text-xs text-ink-muted">A typical account is about 1.0. Adjust the formula in Settings.</p>
        </Card>
      </aside>
    </form>
  );
}
