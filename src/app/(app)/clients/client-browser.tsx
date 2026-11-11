"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRowLink } from "@/components/ui/row-link";
import { Input, Select } from "@/components/ui/input";
import {
  IMPLEMENTATION_TYPE_LABELS,
  IMPLEMENTATION_TYPES,
  STAGE_LABELS,
  STAGES,
  SUPPORT_MODEL_LABELS,
  SUPPORT_MODELS,
  type Stage,
} from "@/lib/clients/constants";
import type { ClientWithFacts as BaseClient } from "@/lib/clients/data";

type ClientWithFacts = BaseClient & { team: { associateId: number; name: string }[] };
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { FastStartBadge, FirstInput, relativeBusinessDays, StageBadge } from "./badges";

type StageFilter = "book" | Stage | "all";

const SERVICE_BOARD_LIMIT = 20;

export function ClientBrowser({ rows, view }: { rows: ClientWithFacts[]; view: "table" | "board" }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("book");
  const [type, setType] = useState("");
  const [model, setModel] = useState("");
  const [fastOnly, setFastOnly] = useState(false);
  const [associate, setAssociate] = useState("");
  const people = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) for (const t of r.team) m.set(t.associateId, t.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (type && r.implementationType !== type) return false;
      if (model && r.supportModel !== model) return false;
      if (fastOnly && !r.fastStart?.isFastStart) return false;
      if (associate && !r.team.some((t) => String(t.associateId) === associate)) return false;
      if (q && !`${r.companyCode ?? ""} ${r.displayName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, type, model, fastOnly, associate]);

  const tableRows = matches.filter((r) =>
    stage === "all" ? true : stage === "book" ? r.lifecycleStage !== "SERVICE" : r.lifecycleStage === stage,
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company code or name"
            aria-label="Search clients"
            className="pl-9"
          />
        </div>
        {view === "table" && (
          <Select value={stage} onChange={(e) => setStage(e.target.value as StageFilter)} aria-label="Filter by stage" className="w-auto">
            <option value="book">Pipeline and book</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
            <option value="all">All stages</option>
          </Select>
        )}
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by implementation type" className="w-auto">
          <option value="">Any type</option>
          {IMPLEMENTATION_TYPES.map((t) => (
            <option key={t} value={t}>{IMPLEMENTATION_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Filter by support model" className="w-auto">
          <option value="">Any model</option>
          {SUPPORT_MODELS.map((m) => (
            <option key={m} value={m}>{SUPPORT_MODEL_LABELS[m]}</option>
          ))}
        </Select>
        {people.length > 0 && (
          <Select value={associate} onChange={(e) => setAssociate(e.target.value)} aria-label="Filter by associate" className="w-auto">
            <option value="">Any associate</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
        )}
        <label className="flex h-10 cursor-pointer items-center gap-2 px-1 text-sm text-ink">
          <input type="checkbox" checked={fastOnly} onChange={(e) => setFastOnly(e.target.checked)} className="size-4 accent-rex-800" />
          Fast starts only
        </label>
      </Card>

      {view === "table" ? <ClientTable rows={tableRows} total={rows.length} /> : <ClientBoard rows={matches} />}
    </div>
  );
}

function ClientTable({ rows, total }: { rows: ClientWithFacts[]; total: number }) {
  const rowLink = useRowLink();
  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[68rem] text-left text-sm">
          <thead>
            <tr className="text-xs tracking-wide whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="px-4 py-3 font-medium">Client</th>
              <th scope="col" className="px-4 py-3 font-medium">Stage</th>
              <th scope="col" className="px-4 py-3 font-medium">Type and model</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Employees</th>
              <th scope="col" className="px-4 py-3 font-medium">Team</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Controls</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Complexity</th>
              <th scope="col" className="px-4 py-3 font-medium">First input</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Weight</th>
              <th scope="col" className="w-8 px-2"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rex-900/6">
            {rows.map((r) => (
              <tr key={r.id} {...rowLink(`/clients/${r.id}`)} className="group cursor-pointer transition-colors hover:bg-white/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${r.id}`}
                    className="font-medium text-rex-950 hover:underline focus-visible:outline-none"
                  >
                    {r.companyCode ? <span className="font-mono tracking-wider">{r.companyCode}</span> : r.displayName}
                  </Link>
                  {r.companyCode && r.displayName && <div className="text-xs text-ink-muted">{r.displayName}</div>}
                  <div className="mt-1 empty:hidden"><FastStartBadge fastStart={r.fastStart} /></div>
                </td>
                <td className="px-4 py-3"><StageBadge stage={r.lifecycleStage} /></td>
                <td className="px-4 py-3 text-ink">
                  {r.implementationType ? IMPLEMENTATION_TYPE_LABELS[r.implementationType] : <span className="text-ink-muted/70">Type not set</span>}
                  <div className="text-xs text-ink-muted">{r.supportModel ? SUPPORT_MODEL_LABELS[r.supportModel] : "Model not set"}</div>
                </td>
                <td className="tabular px-4 py-3 text-right">{r.employeeCount?.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {r.team.length ? (
                    r.team.map((t) => <div key={t.associateId} className="whitespace-nowrap text-ink">{t.name}</div>)
                  ) : r.lifecycleStage === "IMPLEMENTATION" ? (
                    <span className="text-amber-800">Unassigned</span>
                  ) : (
                    <span className="text-ink-muted/70">—</span>
                  )}
                </td>
                <td className="tabular px-4 py-3 text-right">{r.controlCount ?? "—"}</td>
                <td className="tabular px-4 py-3 text-right">{r.payrollComplexity ?? "—"}</td>
                <td className="px-4 py-3"><FirstInput date={r.firstInputDate} days={r.businessDaysToFirstInput} /></td>
                <td className="tabular px-4 py-3 text-right" title={r.weight.incomplete ? "Some inputs are missing" : undefined}>
                  {r.weight.total.toFixed(2)}
                  {r.weight.incomplete && <span className="text-ink-muted">*</span>}
                </td>
                <td className="px-2 py-3 text-rex-400">
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-muted">No clients match these filters.</p>}
      </div>
      <p className="border-t border-rex-900/8 px-4 py-3 text-xs text-ink-muted">
        Showing {rows.length} of {total}. Weights marked * are estimates because some inputs are missing.
      </p>
    </Card>
  );
}

function ClientBoard({ rows }: { rows: ClientWithFacts[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {STAGES.map((stage) => {
        let items = rows.filter((r) => r.lifecycleStage === stage);
        const total = items.length;
        if (stage === "SERVICE") {
          items = [...items].sort((a, b) => b.stageChangedAt.getTime() - a.stageChangedAt.getTime()).slice(0, SERVICE_BOARD_LIMIT);
        }
        return (
          <section key={stage} aria-labelledby={`col-${stage}`} className="glass flex min-h-48 flex-col gap-3 p-3">
            <header className="flex items-center justify-between px-1 pt-1">
              <h2 id={`col-${stage}`} className="text-sm font-semibold text-rex-950">{STAGE_LABELS[stage]}</h2>
              <span className="tabular rounded-full bg-rex-900/8 px-2 text-xs text-ink-muted">{total}</span>
            </header>
            {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-ink-muted">None</p>}
            {items.map((r) => (
              <Link
                key={r.id}
                href={`/clients/${r.id}`}
                className={cn(
                  "block rounded-xl bg-white/75 p-3 ring-1 ring-rex-900/8 transition hover:bg-white hover:shadow-md",
                  stage === "SERVICE" && "opacity-80",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-rex-950">
                      {r.companyCode && <span className="font-mono tracking-wider">{r.companyCode}</span>}
                      {r.companyCode && r.displayName && <span className="text-ink-muted"> · </span>}
                      {r.displayName}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {[
                        r.implementationType && IMPLEMENTATION_TYPE_LABELS[r.implementationType],
                        r.supportModel && SUPPORT_MODEL_LABELS[r.supportModel],
                        r.employeeCount && `${r.employeeCount.toLocaleString()} EEs`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Details not set"}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-xs font-medium text-rex-800" title="Workload weight">
                    {r.weight.total.toFixed(1)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {r.firstInputDate ? (
                    <span className="tabular text-ink">
                      {formatDate(r.firstInputDate)}
                      {r.businessDaysToFirstInput !== null && stage !== "SERVICE" && (
                        <span className="text-ink-muted"> · {relativeBusinessDays(r.businessDaysToFirstInput)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-muted/70">No first input date</span>
                  )}
                  <FastStartBadge fastStart={r.fastStart} />
                </div>
              </Link>
            ))}
            {stage === "SERVICE" && total > items.length && (
              <p className="px-1 text-xs text-ink-muted">Showing the {items.length} most recent. Use the table for all.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
