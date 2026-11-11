import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  Check,
  Circle,
  Gauge,
  ListChecks,
  ListTodo,
  OctagonAlert,
  ShieldAlert,
  UserRoundPlus,
  Zap,
} from "lucide-react";
import { FirstInputTimeline } from "@/components/assign/first-input-timeline";
import { LoadBar } from "@/components/assign/load-bar";
import { ActionItemList } from "@/components/cadence/action-items";
import { ReviewBadge, SeverityBadge } from "@/components/escalations/badges";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { countAssociates } from "@/lib/associates/data";
import { CADENCE_STATUS_LABELS, type CadenceStatus } from "@/lib/cadence/status";
import { listClients } from "@/lib/clients/data";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import { formatDate, formatDateRange } from "@/lib/dates";
import { dashboardData } from "@/lib/insights/data";
import { getApiKeyStatus } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const cadenceTone: Record<CadenceStatus, "danger" | "warning" | "neutral" | "success"> = {
  OVERDUE: "danger",
  DUE_SOON: "warning",
  NEVER: "neutral",
  ON_TRACK: "success",
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium whitespace-nowrap text-rex-700 hover:text-rex-900">
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

export default async function DashboardPage() {
  await requireAdmin();
  const d = dashboardData();
  const keyStatus = getApiKeyStatus();

  const checklist = [
    { done: true, label: "Admin account created", href: null },
    { done: hasEncryptionKey(), label: "Encryption key configured on the server", href: "/settings" },
    { done: keyStatus.configured, label: "Claude API key saved", href: "/settings" },
    { done: countAssociates() > 0, label: "Add your associates", href: "/associates/new" },
    { done: listClients().length > 0, label: "Add clients and prospects", href: "/clients/new" },
  ];
  const showChecklist = checklist.some((c) => !c.done);

  const stats = [
    { label: "Awaiting assignment", icon: UserRoundPlus, value: d.stats.awaiting, href: "/assign", note: d.stats.fastStartsAwaiting ? `${d.stats.fastStartsAwaiting} fast start${d.stats.fastStartsAwaiting === 1 ? "" : "s"}` : null },
    { label: "Active implementations", icon: Building2, value: d.stats.implementations, href: "/clients", note: null },
    { label: "First inputs, next 30 days", icon: CalendarClock, value: d.stats.firstInputs30, href: "/clients", note: null },
    { label: "Open escalations", icon: AlertTriangle, value: d.stats.openEscalations, href: "/escalations", note: d.stats.needsReview ? `${d.stats.needsReview} to review` : null },
  ];

  const redConflicts = d.conflicts.filter((c) => c.level === "red");
  const overdue = d.oneOnOnes.filter((r) => r.status === "OVERDUE");
  const attention = [
    redConflicts.length > 0 && {
      key: "pto",
      icon: OctagonAlert,
      tone: "red",
      text: `${plural(redConflicts.length, "PTO conflict")} near a first input on assigned clients`,
      href: "#pto",
    },
    d.stats.fastStartsAwaiting > 0 && {
      key: "fast",
      icon: Zap,
      tone: "amber",
      text: `${plural(d.stats.fastStartsAwaiting, "fast start")} still need${d.stats.fastStartsAwaiting === 1 ? "s" : ""} a team`,
      href: "/assign",
    },
    d.stats.needsReview > 0 && {
      key: "review",
      icon: ShieldAlert,
      tone: "amber",
      text: `${plural(d.stats.needsReview, "escalation")} waiting for your review`,
      href: "/escalations",
    },
    overdue.length > 0 && {
      key: "cadence",
      icon: CalendarCheck,
      tone: "amber",
      text: `${plural(overdue.length, "overdue 1:1")}`,
      href: "/cadence",
    },
  ].filter((x) => !!x);

  return (
    <>
      <PageHeader title="Dashboard" description="Your book of business at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, icon: Icon, value, href, note }) => (
          <Link key={label} href={href} className="glass block p-5 transition hover:bg-white/70">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">{label}</span>
              <Icon className="size-4 text-rex-500" aria-hidden="true" />
            </div>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="tabular text-3xl font-semibold text-rex-950">{value}</span>
              {note && <span className="text-xs text-ink-muted">{note}</span>}
            </p>
          </Link>
        ))}
      </div>

      {showChecklist && (
        <Card className="mt-6 max-w-2xl">
          <CardHeader icon={<ListChecks />} title="Getting started" description="A few things to set up before Rex is useful." />
          <ul className="divide-y divide-rex-900/5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-3 py-2.5 text-sm">
                {item.done ? (
                  <span className="grid size-5 place-items-center rounded-full bg-rex-900 text-white">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                ) : (
                  <Circle className="size-5 text-rex-300" aria-hidden="true" />
                )}
                <span className={item.done ? "text-ink-muted line-through decoration-rex-300" : "text-ink"}>{item.label}</span>
                <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
                {!item.done && item.href && (
                  <Link href={item.href} className="ml-auto inline-flex items-center gap-1 text-rex-700 hover:text-rex-900">
                    Open <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {attention.length > 0 && (
        <section aria-labelledby="attention-title" className="glass mt-6 px-5 py-4">
          <h2 id="attention-title" className="mb-2 text-sm font-semibold text-rex-950">
            Needs attention
          </h2>
          <ul className="flex flex-col gap-x-6 gap-y-2 text-sm lg:flex-row lg:flex-wrap">
            {attention.map(({ key, icon: Icon, tone, text, href }) => (
              <li key={key}>
                <Link href={href} className="inline-flex items-center gap-2 text-ink hover:underline">
                  <Icon className={cn("size-4 shrink-0", tone === "red" ? "text-red-700" : "text-amber-700")} aria-hidden="true" />
                  {text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              icon={<UserRoundPlus />}
              title="Awaiting assignment"
              description="Implementations without a full team, fast starts first."
              action={d.stats.awaiting > 0 ? <CardLink href="/assign">Queue</CardLink> : undefined}
            />
            {d.queue.length === 0 ? (
              <p className="text-sm text-ink-muted">Every implementation has a full team.</p>
            ) : (
              <ul className="divide-y divide-rex-900/6">
                {d.queue.map((c) => (
                  <li key={c.id} className="py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/assign/${c.id}`} className="min-w-0 truncate font-medium text-rex-950 hover:underline">
                        {c.label}
                      </Link>
                      {c.fastStart && (
                        <Badge tone="warning">
                          <Zap aria-hidden="true" />
                          Fast start
                        </Badge>
                      )}
                    </div>
                    <p className="tabular mt-0.5 text-xs text-ink-muted">
                      {c.firstInputDate ? `First input ${formatDate(c.firstInputDate)}` : "No first input date"} · {c.filled} of {c.seats} seats filled
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {d.stats.awaiting > d.queue.length && (
              <p className="mt-3 text-xs text-ink-muted">And {d.stats.awaiting - d.queue.length} more in the queue.</p>
            )}
          </Card>

          <FirstInputTimeline weeks={d.timeline} days={60} />

          <Card id="pto" className="scroll-mt-6">
            <CardHeader
              icon={<CalendarOff />}
              title="Upcoming PTO"
              description="The next 30 days, plus any later PTO that lands near a key date of a client the associate holds."
            />
            {d.pto.length === 0 ? (
              <p className="text-sm text-ink-muted">No PTO in the next 30 days.</p>
            ) : (
              <ul className="divide-y divide-rex-900/6">
                {d.pto.map((p) => (
                  <li key={p.id} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <Link href={`/associates/${p.associateId}?tab=pto`} className="font-medium text-rex-950 hover:underline">
                        {p.associateName}
                      </Link>
                      <span className="tabular text-ink-muted">
                        {formatDateRange(p.startDate, p.endDate)}
                        {p.isPartialDay && " (partial day)"}
                      </span>
                    </div>
                    {p.conflicts.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {p.conflicts.map((c) => (
                          <li
                            key={`${c.clientId}-${c.kind}`}
                            className={cn("flex items-start gap-1.5 text-xs", c.level === "red" ? "text-red-800" : "text-amber-800")}
                          >
                            {c.level === "red" ? (
                              <OctagonAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>
                              <span className="sr-only">{c.level === "red" ? "Serious: " : "Caution: "}</span>
                              {c.role} on{" "}
                              <Link href={`/clients/${c.clientId}`} className="underline">
                                {c.clientLabel}
                              </Link>
                              , {c.kind === "FIRST_INPUT" ? "first input" : "benefits start"} {formatDate(c.date)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              icon={<Gauge />}
              title="Capacity"
              description="Weighted load per active associate, highest first. Lighter segments are holds on prospects."
            />
            {d.capacity.length === 0 ? (
              <p className="text-sm text-ink-muted">Add associates to see their load.</p>
            ) : (
              <ul className="space-y-3">
                {d.capacity.map((a) => (
                  <li key={a.id} className="grid grid-cols-[9rem_1fr] items-center gap-3">
                    <Link href={`/associates/${a.id}?tab=clients`} className="truncate text-sm font-medium text-rex-950 hover:underline">
                      {a.name}
                    </Link>
                    <LoadBar before={a.load.actual} after={a.load.projected} target={a.targetLoad} band={a.load.band} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<CalendarCheck />}
              title="1:1s"
              description={`Directly managed associates due for a 1:1 (every ${d.cadenceFrequency} days).`}
              action={d.managesAnyone ? <CardLink href="/cadence">Cadence</CardLink> : undefined}
            />
            {!d.managesAnyone ? (
              <p className="text-sm text-ink-muted">Mark associates as directly managed to track 1:1s.</p>
            ) : d.oneOnOnes.length === 0 ? (
              <p className="text-sm text-ink-muted">Every 1:1 is on track.</p>
            ) : (
              <ul className="divide-y divide-rex-900/6">
                {d.oneOnOnes.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                    <Link href={`/associates/${r.id}?tab=cadence#new`} className="min-w-0 flex-1 truncate font-medium text-rex-950 hover:underline">
                      {r.name}
                    </Link>
                    <span className="tabular text-xs text-ink-muted">
                      {r.lastOn ? `Last ${formatDate(r.lastOn)}, ${r.daysSince} days ago` : "No 1:1 logged"}
                    </span>
                    <Badge tone={cadenceTone[r.status]}>{CADENCE_STATUS_LABELS[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<ListTodo />}
              title="Your action items"
              description="Open items you own, from 1:1s and escalations."
              action={d.myItems.length > 0 ? <CardLink href="/cadence">All</CardLink> : undefined}
            />
            <ActionItemList
              showAssociate
              emptyText="Nothing open."
              items={d.myItems.slice(0, 6).map((i) => ({
                id: i.id,
                text: i.text,
                owner: i.owner,
                dueHint: i.dueHint,
                status: i.status,
                associateName: i.associateName,
              }))}
            />
            {d.myItems.length > 6 && <p className="mt-3 text-xs text-ink-muted">And {d.myItems.length - 6} more.</p>}
          </Card>

          <Card>
            <CardHeader
              icon={<AlertTriangle />}
              title="Open escalations"
              action={d.stats.openEscalations > 0 ? <CardLink href="/escalations">Log</CardLink> : undefined}
            />
            {d.openEscalations.length === 0 ? (
              <p className="text-sm text-ink-muted">No open escalations.</p>
            ) : (
              <ul className="divide-y divide-rex-900/6">
                {d.openEscalations.map((e) => (
                  <li key={e.id} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/escalations/${e.id}`} className="tabular font-medium text-rex-950 hover:underline">
                        {formatDate(e.occurredOn)}
                      </Link>
                      {e.clientLabel && <span className="text-ink-muted">{e.clientLabel}</span>}
                      {e.severity && <SeverityBadge severity={e.severity} />}
                      {!e.confirmed && <ReviewBadge confirmed={false} />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-ink">{e.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
