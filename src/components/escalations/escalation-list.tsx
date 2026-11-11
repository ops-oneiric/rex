"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { CATEGORY_LABELS, type EscalationCategory, type FaultParty, type Severity } from "@/lib/escalations/constants";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { FaultBadge, ReviewBadge, SeverityBadge, StatusBadge } from "./badges";

export type EscalationListItem = {
  id: number;
  occurredOn: string;
  status: "OPEN" | "RESOLVED";
  confirmed: boolean;
  analyzing: boolean;
  /** Your confirmed values, or Claude's suggestion until you confirm. */
  summary: string;
  category: EscalationCategory | null;
  severity: Severity | null;
  faultParty: FaultParty | null;
  clientLabel: string | null;
  people: string[];
};

export function EscalationList({ items, compact }: { items: EscalationListItem[]; compact?: boolean }) {
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "ALL">("ALL");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((e) => {
      if (status !== "ALL" && e.status !== status) return false;
      if (reviewOnly && e.confirmed) return false;
      if (q && ![e.summary, e.clientLabel ?? "", ...e.people].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, status, reviewOnly, query]);

  return (
    <Card className="p-0">
      {!compact && (
        <div className="flex flex-wrap items-center gap-3 border-b border-rex-900/8 p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client, associate or summary"
              aria-label="Search escalations"
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="w-auto">
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          <label className="flex h-10 cursor-pointer items-center gap-2 px-1 text-sm text-ink">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} className="size-4 accent-rex-800" />
            Needs review
          </label>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-muted">{items.length ? "No escalations match these filters." : "No escalations yet."}</p>
      ) : (
        <ul className="divide-y divide-rex-900/6">
          {shown.map((e) => (
            <li key={e.id} className="group relative px-4 py-3.5 transition-colors hover:bg-white/60">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/escalations/${e.id}`} className="tabular text-sm font-medium text-rex-950 after:absolute after:inset-0 hover:underline">
                      {formatDate(e.occurredOn)}
                    </Link>
                    {e.clientLabel && <span className="text-sm text-ink">· {e.clientLabel}</span>}
                    <StatusBadge status={e.status} />
                    <SeverityBadge severity={e.severity} />
                    {e.category && <span className="text-xs text-ink-muted">{CATEGORY_LABELS[e.category]}</span>}
                    <FaultBadge fault={e.faultParty} />
                    <ReviewBadge confirmed={e.confirmed} />
                    {e.analyzing && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        Analyzing
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-1 text-sm text-ink-muted", compact ? "line-clamp-1" : "line-clamp-2")}>{e.summary}</p>
                  {e.people.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">Involved: {e.people.join(", ")}</p>}
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-rex-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
