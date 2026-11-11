import Link from "next/link";
import { ArrowRight, CircleCheck, UserRoundPlus } from "lucide-react";
import { FirstInputTimeline } from "@/components/assign/first-input-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { assignmentQueue, firstInputTimeline, type QueueItem } from "@/lib/assignments/data";
import { seatLabel } from "@/lib/assignments/seats";
import { requireAdmin } from "@/lib/auth/dal";
import { clientLabel, SUPPORT_MODEL_LABELS } from "@/lib/clients/constants";
import { cn } from "@/lib/utils";
import { FastStartBadge, FirstInput } from "../clients/badges";

export const metadata = { title: "Assign" };

export default async function AssignPage() {
  await requireAdmin();
  const { implementations, prospects } = assignmentQueue();
  const timeline = firstInputTimeline(60);

  return (
    <>
      <PageHeader
        title="Assign"
        description="Implementations that still need a team, most urgent first. Prospects can take optional holds."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="min-w-0 space-y-6">
          <Card className="p-0">
            <h2 className="px-6 pt-5 pb-3 text-base font-semibold text-rex-950">Needs a team ({implementations.length})</h2>
            {implementations.length === 0 ? (
              <EmptyState icon={<CircleCheck />} title="Every implementation has a full team" />
            ) : (
              <QueueTable items={implementations} />
            )}
          </Card>
          <Card className="p-0">
            <h2 className="px-6 pt-5 pb-1 text-base font-semibold text-rex-950">Prospects ({prospects.length})</h2>
            <p className="px-6 pb-3 text-sm text-ink-muted">Holds show as projected load and become the team when the client moves to Implementation.</p>
            {prospects.length === 0 ? (
              <EmptyState icon={<UserRoundPlus />} title="No prospects with a support model" description="Set a support model on a prospect to hold associates for it." />
            ) : (
              <QueueTable items={prospects} holds />
            )}
          </Card>
        </div>
        <FirstInputTimeline weeks={timeline} days={60} />
      </div>
    </>
  );
}

function QueueTable({ items, holds }: { items: QueueItem[]; holds?: boolean }) {
  return (
    <ul className="divide-y divide-rex-900/6 border-t border-rex-900/8">
      {items.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3.5">
          <div className="min-w-40 flex-1">
            <Link href={`/clients/${c.id}`} className="font-medium text-rex-950 hover:underline">{clientLabel(c)}</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {SUPPORT_MODEL_LABELS[c.supportModel!]} · weight {c.weight.total.toFixed(2)}
              <FastStartBadge fastStart={c.fastStart} />
            </div>
          </div>
          <div className="w-36 text-sm"><FirstInput date={c.firstInputDate} days={c.businessDaysToFirstInput} /></div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Seats">
            {c.seats.map((s) => (
              <li
                key={s.seat}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs ring-1 ring-inset",
                  s.assignment ? "bg-rex-100 text-rex-800 ring-rex-300/60" : "border border-dashed border-rex-900/20 bg-white/50 text-ink-muted ring-0",
                )}
              >
                {seatLabel(s.seat, c.supportModel)}: {s.assignment?.associateName ?? "open"}
              </li>
            ))}
          </ul>
          <Link
            href={`/assign/${c.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rex-900 px-3 text-sm font-medium text-white hover:bg-rex-800"
            aria-label={`${holds ? "Hold associates for" : "Assign team for"} ${clientLabel(c)}`}
          >
            {holds ? "Holds" : "Assign"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
