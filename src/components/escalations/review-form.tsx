"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldHint, Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  CATEGORY_LABELS,
  ESCALATION_CATEGORIES,
  type EscalationCategory,
  FAULT_LABELS,
  FAULT_PARTIES,
  type FaultParty,
  PREVENTABLE,
  PREVENTABLE_LABELS,
  type Preventable,
  SEVERITIES,
  SEVERITY_LABELS,
  type Severity,
} from "@/lib/escalations/constants";
import { confirmEscalationAction } from "@/app/(app)/escalations/actions";

export type ReviewValues = {
  clientId: number | null;
  summary: string;
  associateIds: number[];
  faultAssociateIds: number[];
  category: EscalationCategory;
  severity: Severity;
  faultParty: FaultParty;
  faultRationale: string;
  rootCause: string;
  preventable: Preventable;
};

type Props = {
  escalationId: number;
  initial: ReviewValues;
  /** Where the values came from, for the header. */
  source: "confirmed" | "suggestion" | "blank";
  confirmedOn: string | null;
  suggestedActions: { text: string; owner: "ME" | "ASSOCIATE" }[];
  cautions: string[];
  clients: { id: number; label: string }[];
  associates: { id: number; name: string; isActive: boolean }[];
};

export function ReviewForm({ escalationId, initial, source, confirmedOn, suggestedActions, cautions, clients, associates }: Props) {
  const [v, setV] = useState(initial);
  const [actions, setActions] = useState(suggestedActions.map((a) => ({ ...a, keep: true })));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ReviewValues>(k: K, value: ReviewValues[K]) => setV((x) => ({ ...x, [k]: value }));
  const faultCanName = v.faultParty === "ASSOCIATE" || v.faultParty === "SHARED";
  const people = associates.filter((a) => a.isActive || v.associateIds.includes(a.id));

  const toggleInvolved = (id: number, on: boolean) =>
    setV((x) => ({
      ...x,
      associateIds: on ? [...x.associateIds, id] : x.associateIds.filter((a) => a !== id),
      faultAssociateIds: on ? x.faultAssociateIds : x.faultAssociateIds.filter((a) => a !== id),
    }));
  const toggleFault = (id: number, on: boolean) =>
    setV((x) => ({
      ...x,
      faultAssociateIds: on ? [...x.faultAssociateIds, id] : x.faultAssociateIds.filter((a) => a !== id),
      associateIds: on && !x.associateIds.includes(id) ? [...x.associateIds, id] : x.associateIds,
    }));

  const submit = () =>
    start(async () => {
      const r = await confirmEscalationAction(escalationId, {
        ...v,
        faultAssociateIds: faultCanName ? v.faultAssociateIds : [],
        actions: actions.filter((a) => a.keep && a.text.trim().length >= 2).map(({ text, owner }) => ({ text, owner })),
      });
      setMessage({ ok: !!r.ok, text: r.message ?? "" });
      if (r.ok) setActions([]);
    });

  return (
    <Card>
      <CardHeader
        icon={source === "suggestion" ? <Sparkles /> : <Check />}
        title={source === "confirmed" ? "Your review" : "Review and confirm"}
        description={
          source === "confirmed"
            ? `Confirmed ${confirmedOn}. Saving again replaces the confirmed values.`
            : source === "suggestion"
              ? "Prefilled with Claude's suggestions. Check each field, change anything that's wrong, then confirm. Only confirmed escalations count in trends."
              : "Fill these in yourself, or wait for Claude's suggestions."
        }
      />
      {cautions.length > 0 && source !== "confirmed" && (
        <Alert tone="info" className="mb-4">
          <ul className="list-disc space-y-0.5 pl-4">
            {cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="space-y-4">
        <div>
          <Label htmlFor="r-summary">Summary</Label>
          <Textarea id="r-summary" rows={2} value={v.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="r-client">Client</Label>
            <Select id="r-client" value={v.clientId ?? ""} onChange={(e) => set("clientId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Not a specific client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="r-category">Category</Label>
            <Select id="r-category" value={v.category} onChange={(e) => set("category", e.target.value as EscalationCategory)}>
              {ESCALATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="r-severity">Severity</Label>
            <Select id="r-severity" value={v.severity} onChange={(e) => set("severity", e.target.value as Severity)}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="r-fault">Fault</Label>
            <Select id="r-fault" value={v.faultParty} onChange={(e) => set("faultParty", e.target.value as FaultParty)}>
              {FAULT_PARTIES.map((f) => (
                <option key={f} value={f}>{FAULT_LABELS[f]}</option>
              ))}
            </Select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-rex-950">People involved</legend>
          {people.length === 0 ? (
            <p className="text-sm text-ink-muted">No associates yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {people.map((a) => {
                const involved = v.associateIds.includes(a.id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/50 px-3 py-2 ring-1 ring-rex-900/8">
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={involved} onChange={(e) => toggleInvolved(a.id, e.target.checked)} className="size-4 accent-rex-800" />
                      {a.name}
                    </label>
                    {faultCanName && (
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <input
                          type="checkbox"
                          checked={v.faultAssociateIds.includes(a.id)}
                          onChange={(e) => toggleFault(a.id, e.target.checked)}
                          className="size-3.5 accent-red-700"
                          aria-label={`${a.name} at fault`}
                        />
                        At fault
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {faultCanName && <FieldHint>Tick &ldquo;At fault&rdquo; only where the details support it.</FieldHint>}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
          <div>
            <Label htmlFor="r-root">Root cause</Label>
            <Input id="r-root" value={v.rootCause} onChange={(e) => set("rootCause", e.target.value)} maxLength={1000} />
          </div>
          <div>
            <Label htmlFor="r-prev">Preventable</Label>
            <Select id="r-prev" value={v.preventable} onChange={(e) => set("preventable", e.target.value as Preventable)}>
              {PREVENTABLE.map((p) => (
                <option key={p} value={p}>{PREVENTABLE_LABELS[p]}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="r-rationale">Why fault was aligned this way</Label>
          <Textarea id="r-rationale" rows={2} value={v.faultRationale} onChange={(e) => set("faultRationale", e.target.value)} />
        </div>

        {actions.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-rex-950">Suggested action items</legend>
            <ul className="space-y-1.5">
              {actions.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={a.keep}
                    onChange={(e) => setActions((xs) => xs.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                    className="size-4 accent-rex-800"
                    aria-label={`Create action item: ${a.text}`}
                  />
                  <span className="flex-1 text-ink">{a.text}</span>
                  <span className="text-xs text-ink-muted">{a.owner === "ME" ? "You" : "Associate"}</span>
                </li>
              ))}
            </ul>
            <FieldHint>Ticked items are added to the action item checklist when you confirm.</FieldHint>
          </fieldset>
        )}

        <Button onClick={submit} disabled={pending || !v.summary.trim()}>
          <Check aria-hidden="true" />
          {pending ? "Saving..." : source === "confirmed" ? "Save review" : "Confirm"}
        </Button>
        {message && <Alert tone={message.ok ? "success" : "error"}>{message.text}</Alert>}
      </div>
    </Card>
  );
}
