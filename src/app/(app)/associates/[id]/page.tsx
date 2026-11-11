import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarCheck } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { getAssociate, getAssociateCapabilities, listPto } from "@/lib/associates/data";
import { seatSummary } from "@/lib/associates/validation";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { today as getToday } from "@/lib/settings";
import { timeZoneLabel, timeZoneOffset } from "@/lib/time-zones";
import { addPtoAction, saveCapabilitiesAction } from "../actions";
import { CapabilityChip, ManagedBadge, PtoStatus, SeatBadges } from "../badges";
import { AssociateActions } from "./associate-actions";
import { CapabilityEditor } from "./capability-editor";
import { PtoPanel } from "./pto-panel";
import { ClientsTab } from "./clients-tab";
import { associateAssignments } from "@/lib/assignments/data";

const TABS = ["profile", "capabilities", "pto", "clients", "cadence", "escalations"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/associates/[id]">) {
  const associate = getAssociate(Number((await params).id));
  return { title: associate?.name ?? "Associate" };
}

export default async function AssociatePage({ params, searchParams }: PageProps<"/associates/[id]">) {
  await requireAdmin();
  const associate = getAssociate(Number((await params).id));
  if (!associate) notFound();

  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "profile";
  const justCreated = sp.created === "1";
  const today = getToday();
  const capabilities = getAssociateCapabilities(associate.id);
  const assigned = capabilities.filter((c) => c.proficiency > 0);
  const pto = listPto(associate.id);
  const upcomingPto = pto.filter((p) => p.endDate >= today);
  const base = `/associates/${associate.id}`;

  return (
    <>
      <Link href="/associates" className="mb-4 inline-flex items-center gap-1.5 text-sm text-rex-700 hover:text-rex-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All associates
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-rex-950">{associate.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            {associate.title && <span>{associate.title}</span>}
            <SeatBadges canPm={associate.canPm} canPayroll={associate.canPayroll} />
            {associate.isDirectlyManaged && <ManagedBadge />}
            {!associate.isActive && <Badge tone="warning">Inactive: excluded from recommendations</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AssociateActions id={associate.id} name={associate.name} isActive={associate.isActive} />
        </div>
      </header>

      {justCreated && (
        <Alert tone="success" className="mb-6">
          {associate.name} was added. Set their capability levels below, then add any upcoming PTO.
        </Alert>
      )}

      <Tabs
        label="Associate sections"
        active={tab}
        items={[
          { id: "profile", label: "Profile", href: base },
          { id: "capabilities", label: "Capabilities", href: `${base}?tab=capabilities`, count: assigned.length },
          { id: "pto", label: "PTO", href: `${base}?tab=pto`, count: upcomingPto.length },
          {
            id: "clients",
            label: "Clients",
            href: `${base}?tab=clients`,
            count: associateAssignments(associate.id).filter((r) => r.a.status === "ACTIVE").length,
          },
          ...(associate.isDirectlyManaged
            ? [{ id: "cadence", label: "Cadence", href: `${base}?tab=cadence`, muted: true }]
            : []),
          { id: "escalations", label: "Escalations", href: `${base}?tab=escalations`, muted: true },
        ]}
      />

      {tab === "profile" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-base font-semibold text-rex-950">Details</h2>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-muted">Email</dt>
              <dd className="min-w-0 break-words">{associate.email ?? <span className="text-ink-muted/70">Not set</span>}</dd>
              <dt className="text-ink-muted">Time zone</dt>
              <dd>
                {timeZoneLabel(associate.timeZone)}{" "}
                <span className="text-ink-muted">
                  ({associate.timeZone}, {timeZoneOffset(associate.timeZone)})
                </span>
              </dd>
              <dt className="text-ink-muted">Seats</dt>
              <dd>{seatSummary(associate.canPm, associate.canPayroll)}</dd>
              <dt className="text-ink-muted">Target load</dt>
              <dd className="tabular">{associate.targetLoad} weighted units</dd>
              <dt className="text-ink-muted">Cadence</dt>
              <dd>{associate.isDirectlyManaged ? "Managed by you" : "Not tracked"}</dd>
              <dt className="text-ink-muted">Added</dt>
              <dd className="tabular">{formatDate(associate.createdAt.toISOString().slice(0, 10))}</dd>
            </dl>
          </Card>
          <div className="space-y-6">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-rex-950">Capabilities</h2>
                <Link
                  href={`${base}?tab=capabilities`}
                  aria-label="Edit capabilities"
                  className="text-sm text-rex-700 hover:text-rex-900"
                >
                  Edit
                </Link>
              </div>
              {assigned.length === 0 ? (
                <p className="text-sm text-ink-muted">No capability levels set yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[...assigned]
                    .sort((a, b) => b.proficiency - a.proficiency)
                    .map((c) => (
                      <CapabilityChip key={c.id} name={c.name} proficiency={c.proficiency} />
                    ))}
                </div>
              )}
              {associate.capabilityNotes && (
                <p className="mt-4 text-sm whitespace-pre-line text-ink">{associate.capabilityNotes}</p>
              )}
            </Card>
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-rex-950">Next PTO</h2>
                <Link href={`${base}?tab=pto`} aria-label="Manage PTO" className="text-sm text-rex-700 hover:text-rex-900">
                  Manage
                </Link>
              </div>
              <div className="text-sm">
                <PtoStatus pto={upcomingPto[0] ?? null} today={today} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "capabilities" && (
        <CapabilityEditor
          action={saveCapabilitiesAction.bind(null, associate.id)}
          rows={capabilities}
          notes={associate.capabilityNotes}
        />
      )}

      {tab === "pto" && (
        <PtoPanel
          associateId={associate.id}
          name={associate.name}
          action={addPtoAction.bind(null, associate.id)}
          entries={pto.map(({ id, startDate, endDate, isPartialDay, note }) => ({
            id,
            startDate,
            endDate,
            isPartialDay,
            note,
          }))}
          today={today}
        />
      )}

      {tab === "clients" && <ClientsTab associateId={associate.id} targetLoad={associate.targetLoad} />}
      {tab === "cadence" && (
        <ComingSoon
          phase={5}
          icon={<CalendarCheck />}
          title="1:1 notes"
          points={["Meeting history with Claude's insights", "Open action items and trends"]}
        />
      )}
      {tab === "escalations" && (
        <ComingSoon
          phase={6}
          icon={<AlertTriangle />}
          title="Escalations"
          points={["Escalations involving this associate", "Fault alignment and trends"]}
        />
      )}
    </>
  );
}
