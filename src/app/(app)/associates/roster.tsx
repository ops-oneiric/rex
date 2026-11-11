"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRowLink } from "@/components/ui/row-link";
import { Input, Select } from "@/components/ui/input";
import { LoadBar } from "@/components/assign/load-bar";
import type { RosterRow } from "@/lib/associates/data";
import type { AssociateLoad } from "@/lib/assignments/data";
import { formatDate } from "@/lib/dates";
import { timeZoneLabel } from "@/lib/time-zones";
import { cn } from "@/lib/utils";
import { CapabilityChip, ManagedBadge, PtoStatus, SeatBadges } from "./badges";

type Status = "active" | "inactive" | "all";
type Seat = "any" | "pm" | "payroll" | "hybrid";

const MAX_CHIPS = 3;

type Row = RosterRow & { load: AssociateLoad | null };

export function Roster({ rows, today }: { rows: Row[]; today: string }) {
  const rowLink = useRowLink();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [seat, setSeat] = useState<Seat>("any");
  const [managedOnly, setManagedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.isActive) return false;
      if (status === "inactive" && r.isActive) return false;
      if (seat === "pm" && !r.canPm) return false;
      if (seat === "payroll" && !r.canPayroll) return false;
      if (seat === "hybrid" && !(r.canPm && r.canPayroll)) return false;
      if (managedOnly && !r.isDirectlyManaged) return false;
      if (!q) return true;
      return [r.name, r.title ?? "", r.email ?? "", ...r.capabilities.map((c) => c.name)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, status, seat, managedOnly]);

  const inactiveCount = rows.filter((r) => !r.isActive).length;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-rex-900/8 p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, title or capability"
            aria-label="Search associates"
            className="pl-9"
          />
        </div>
        <Select
          value={seat}
          onChange={(e) => setSeat(e.target.value as Seat)}
          aria-label="Filter by seat"
          className="w-auto"
        >
          <option value="any">Any seat</option>
          <option value="pm">Can do PM</option>
          <option value="payroll">Can do Payroll</option>
          <option value="hybrid">Hybrid-eligible</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          aria-label="Filter by status"
          className="w-auto"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive ({inactiveCount})</option>
          <option value="all">All</option>
        </Select>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={managedOnly}
            onChange={(e) => setManagedOnly(e.target.checked)}
            className="size-4 accent-rex-800"
          />
          Managed by me
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead>
            <tr className="text-xs tracking-wide whitespace-nowrap text-ink-muted uppercase">
              <th scope="col" className="px-4 py-3 font-medium">Associate</th>
              <th scope="col" className="px-4 py-3 font-medium">Seats</th>
              <th scope="col" className="px-4 py-3 font-medium">Time zone</th>
              <th scope="col" className="px-4 py-3 font-medium">Capabilities</th>
              <th scope="col" className="px-4 py-3 font-medium">Next PTO</th>
              <th scope="col" className="px-4 py-3 font-medium">Load</th>
              <th scope="col" className="w-8 px-2"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rex-900/6">
            {filtered.map((r) => (
              <tr
                key={r.id}
                {...rowLink(`/associates/${r.id}`)}
                className={cn("group cursor-pointer transition-colors hover:bg-white/60", !r.isActive && "opacity-60")}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/associates/${r.id}`}
                    className="font-medium text-rex-950 hover:underline focus-visible:outline-none"
                  >
                    {r.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                    {r.title && <span>{r.title}</span>}
                    {r.isDirectlyManaged && <ManagedBadge />}
                    {!r.isActive && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SeatBadges canPm={r.canPm} canPayroll={r.canPayroll} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink">{timeZoneLabel(r.timeZone)}</td>
                <td className="px-4 py-3">
                  {r.capabilities.length === 0 ? (
                    <span className="text-ink-muted/70">Not set</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {r.capabilities.slice(0, MAX_CHIPS).map((c) => (
                        <CapabilityChip key={c.name} {...c} />
                      ))}
                      {r.capabilities.length > MAX_CHIPS && (
                        <span className="px-1 text-xs text-ink-muted">+{r.capabilities.length - MAX_CHIPS}</span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PtoStatus pto={r.nextPto} today={today} />
                </td>
                <td className="px-4 py-3">
                  {r.load ? (
                    <>
                      <LoadBar className="w-40" before={r.load.projected} target={r.targetLoad} band={r.load.band} />
                      <p className="mt-1 text-xs text-ink-muted">
                        {r.load.accounts} account{r.load.accounts === 1 ? "" : "s"}
                        {r.load.holds > 0 && `, ${r.load.holds} hold${r.load.holds === 1 ? "" : "s"}`}
                        {r.load.nextFirstInput && ` · next input ${formatDate(r.load.nextFirstInput).replace(/, \d{4}$/, "")}`}
                      </p>
                    </>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-rex-400">
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">No associates match these filters.</p>
        )}
      </div>
      <p className="border-t border-rex-900/8 px-4 py-3 text-xs text-ink-muted">
        Showing {filtered.length} of {rows.length}. Load is the weighted sum of their seats on Implementation clients, plus holds on prospects; the tick marks each person&apos;s target.
      </p>
    </Card>
  );
}
