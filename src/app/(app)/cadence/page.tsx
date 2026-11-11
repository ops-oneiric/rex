import Link from "next/link";
import { CalendarCheck, ListTodo, NotebookPen } from "lucide-react";
import { ActionItemList } from "@/components/cadence/action-items";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/dal";
import { cadenceOverview } from "@/lib/cadence/data";
import { CADENCE_STATUS_LABELS, type CadenceStatus } from "@/lib/cadence/status";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Cadence" };

const statusTone: Record<CadenceStatus, "neutral" | "success" | "warning" | "danger"> = {
  NEVER: "neutral",
  ON_TRACK: "success",
  DUE_SOON: "warning",
  OVERDUE: "danger",
};

export default async function CadencePage() {
  await requireAdmin();
  const { frequency, rows, myOpenItems } = cadenceOverview();
  const order: CadenceStatus[] = ["OVERDUE", "NEVER", "DUE_SOON", "ON_TRACK"];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (b.daysSince ?? 0) - (a.daysSince ?? 0));

  return (
    <>
      <PageHeader
        title="Cadence"
        description={`1:1s with the associates you manage directly, expected every ${frequency} days. Change the rhythm in Settings.`}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck />}
            title="No directly managed associates"
            description="Edit an associate and tick 'I manage this associate directly' to track 1:1s with them here."
            action={
              <Link href="/associates" className="text-sm font-medium text-rex-700 hover:text-rex-900">
                Go to Associates
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem]">
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="text-xs tracking-wide whitespace-nowrap text-ink-muted uppercase">
                    <th scope="col" className="px-4 py-3 font-medium">Associate</th>
                    <th scope="col" className="px-4 py-3 font-medium">Last 1:1</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Open items</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Log</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rex-900/6">
                  {sorted.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <Link href={`/associates/${r.id}?tab=cadence`} className="font-medium text-rex-950 hover:underline">
                          {r.name}
                        </Link>
                        {r.title && <div className="text-xs text-ink-muted">{r.title}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {r.lastOn ? (
                          <>
                            <span className="tabular">{formatDate(r.lastOn)}</span>
                            <div className="text-xs text-ink-muted">
                              {r.daysSince === 0 ? "today" : `${r.daysSince} day${r.daysSince === 1 ? "" : "s"} ago`} · {r.meetings} total
                            </div>
                          </>
                        ) : (
                          <span className="text-ink-muted/70">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone[r.status]}>{CADENCE_STATUS_LABELS[r.status]}</Badge>
                      </td>
                      <td className="tabular px-4 py-3 text-xs text-ink">
                        {r.openMine + r.openTheirs === 0 ? (
                          <span className="text-ink-muted/70">None</span>
                        ) : (
                          <>
                            {r.openMine} yours · {r.openTheirs} theirs
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/associates/${r.id}?tab=cadence#new`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rex-900 px-3 text-sm font-medium whitespace-nowrap text-white hover:bg-rex-800"
                          aria-label={`Log a 1:1 with ${r.name}`}
                        >
                          <NotebookPen className="size-4" aria-hidden="true" />
                          Log 1:1
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader icon={<ListTodo />} title="Your open action items" description="Things you agreed to do, across all 1:1s." />
            <ActionItemList
              showAssociate
              emptyText="Nothing open. Nice."
              items={myOpenItems.map((i) => ({
                id: i.id,
                text: i.text,
                owner: i.owner,
                dueHint: i.dueHint,
                status: i.status,
                associateName: i.associateName,
              }))}
            />
          </Card>
        </div>
      )}
    </>
  );
}
