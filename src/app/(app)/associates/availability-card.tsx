import Link from "next/link";
import { Flag, Gauge, Plane } from "lucide-react";
import { LoadBar } from "@/components/assign/load-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { AVAILABILITY_WINDOW, type AvailabilityRow } from "@/lib/associates/availability";
import { formatDateRange } from "@/lib/dates";

function Ranking({ title, rows, label }: { title: string; rows: AvailabilityRow[]; label: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No active associates can take this seat.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Associate</th>
              <th scope="col">Load and coming up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rex-900/6">
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="w-8 py-2.5 pr-2 align-top">
                  <span className="tabular grid size-6 place-items-center rounded-full bg-rex-100 text-xs font-semibold text-rex-800">{i + 1}</span>
                </td>
                <td className="w-36 py-2.5 pr-3 align-top">
                  <Link href={`/associates/${r.id}?tab=clients`} className="font-medium text-rex-950 hover:underline">
                    {r.name}
                  </Link>
                  {r.outToday && (
                    <div className="mt-0.5">
                      <Badge tone="warning">Out today</Badge>
                    </div>
                  )}
                </td>
                <td className="py-2.5 align-top">
                  <LoadBar before={r.load} target={r.targetLoad} band={r.band} />
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                    <span className="tabular">{r.room > 0 ? `${r.room.toFixed(1)} under target` : r.room === 0 ? "At target" : `${Math.abs(r.room).toFixed(1)} over target`}</span>
                    {r.nextPto && (
                      <span className="inline-flex items-center gap-1">
                        <Plane className="size-3" aria-hidden="true" />
                        PTO {formatDateRange(r.nextPto.startDate, r.nextPto.endDate)}
                      </span>
                    )}
                    {r.firstInputsSoon > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Flag className="size-3" aria-hidden="true" />
                        {r.firstInputsSoon} first input{r.firstInputsSoon === 1 ? "" : "s"} coming up
                      </span>
                    )}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Top three by general availability for each kind of seat. The same person can appear in both. */
export function AvailabilityCard({ pm, payroll }: { pm: AvailabilityRow[]; payroll: AvailabilityRow[] }) {
  return (
    <Card className="mb-6">
      <CardHeader
        icon={<Gauge />}
        title="Most available"
        description={`Ranked by room under each person's target load, less PTO and first inputs in the next ${AVAILABILITY_WINDOW} business days. First inputs count less for PM work. Hybrid-eligible people appear in both lists. For a specific client, use Assign.`}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Ranking title="Project managers" label="Most available for a PM seat" rows={pm} />
        <Ranking title="Payroll" label="Most available for a payroll seat" rows={payroll} />
      </div>
    </Card>
  );
}
