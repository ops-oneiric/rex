import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  Circle,
  ListChecks,
  UserRoundPlus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { getApiKeyStatus } from "@/lib/settings";
import { hasEncryptionKey } from "@/lib/crypto/secrets";
import { countAssociates, listRoster } from "@/lib/associates/data";
import { listClients } from "@/lib/clients/data";
import { addDays } from "@/lib/dates";
import { today } from "@/lib/settings";
import { allLoads, assignmentQueue, firstInputTimeline } from "@/lib/assignments/data";
import { FirstInputTimeline } from "@/components/assign/first-input-timeline";
import { LoadBar } from "@/components/assign/load-bar";
import { Gauge } from "lucide-react";

export const metadata = { title: "Dashboard" };


export default async function DashboardPage() {
  await requireAdmin();
  const keyStatus = getApiKeyStatus();
  const clients = listClients();
  const implementations = clients.filter((c) => c.lifecycleStage === "IMPLEMENTATION");
  const todayIso = today();
  const in30 = addDays(todayIso, 30);
  const stats = [
    { label: "Awaiting assignment", icon: UserRoundPlus, value: assignmentQueue().implementations.length, href: "/assign" },
    { label: "Active implementations", icon: Building2, value: implementations.length, href: "/clients" },
    {
      label: "First inputs, next 30 days",
      icon: CalendarClock,
      value: implementations.filter((c) => c.firstInputDate && c.firstInputDate >= todayIso && c.firstInputDate <= in30).length,
      href: "/clients",
    },
    { label: "Open escalations", icon: AlertTriangle, value: 0, href: null },
  ];

  const checklist = [
    { done: true, label: "Admin account created", href: null },
    { done: hasEncryptionKey(), label: "Encryption key configured on the server", href: "/settings" },
    { done: keyStatus.configured, label: "Claude API key saved", href: "/settings" },
    { done: countAssociates() > 0, label: "Add your associates", href: "/associates/new" },
    { done: clients.length > 0, label: "Add clients and prospects", href: "/clients/new" },
  ];
  const showChecklist = checklist.some((c) => !c.done);
  const loads = allLoads();
  const roster = listRoster(todayIso)
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, name: a.name, targetLoad: a.targetLoad, load: loads.get(a.id)! }))
    .sort((a, b) => b.load.projected - a.load.projected);

  return (
    <>
      <PageHeader title="Dashboard" description="Your book of business at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, icon: Icon, value, href }) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">{label}</span>
                <Icon className="size-4 text-rex-500" aria-hidden="true" />
              </div>
              <p className="tabular mt-3 text-3xl font-semibold text-rex-950">{value}</p>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="glass block p-5 transition hover:bg-white/70">
              {body}
            </Link>
          ) : (
            <Card key={label} className="p-5">
              {body}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Gauge />}
            title="Capacity"
            description="Weighted load per active associate, highest first. Lighter segments are holds on prospects."
          />
          {roster.length === 0 ? (
            <p className="text-sm text-ink-muted">Add associates to see their load.</p>
          ) : (
            <ul className="space-y-3">
              {roster.map((a) => (
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
        <FirstInputTimeline weeks={firstInputTimeline(30)} days={30} />
      </div>

      {showChecklist && (
        <Card className="mt-6 max-w-2xl">
        <CardHeader
          icon={<ListChecks />}
          title="Getting started"
          description="Rex fills in as each phase is delivered."
        />
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
              <span className={item.done ? "text-ink-muted line-through decoration-rex-300" : "text-ink"}>
                {item.label}
              </span>
              <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
              {!item.done && item.href && (
                <Link
                  href={item.href}
                  className="ml-auto inline-flex items-center gap-1 text-rex-700 hover:text-rex-900"
                >
                  Open <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
      )}
    </>
  );
}
