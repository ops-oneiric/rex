import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarClock, History, Scale } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import {
  clientLabel,
  IMPLEMENTATION_TYPE_LABELS,
  PREVIOUS_VENDOR_LABELS,
  STAGE_LABELS,
  SUPPORT_MODEL_LABELS,
  SUPPORT_MODEL_SEATS,
} from "@/lib/clients/constants";
import { getClient, getStageHistory, withFacts } from "@/lib/clients/data";
import { allowedTransitions, missingForStage } from "@/lib/clients/validation";
import { formatDate } from "@/lib/dates";
import { getComplexityScale, getHomeTimeZone } from "@/lib/settings";
import { timeZoneLabel } from "@/lib/time-zones";
import { FastStartBadge, relativeBusinessDays, StageBadge } from "../badges";
import { ClientActions } from "./stage-actions";
import { TeamCard } from "./team-card";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">) {
  const client = getClient(Number((await params).id));
  return { title: client ? clientLabel(client) : "Client" };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  await requireAdmin();
  const row = getClient(Number((await params).id));
  if (!row) notFound();
  const [client] = withFacts([row]);
  const sp = await searchParams;
  const justCreated = sp.created === "1";
  const seatsEnded = Number(sp.seatsEnded ?? 0);
  const history = getStageHistory(client!.id);
  const c = client!;
  const missing = c.lifecycleStage === "PROSPECT" ? missingForStage(c, "IMPLEMENTATION").map(([, l]) => l) : [];
  const complexityScale = getComplexityScale();
  const notSet = <span className="text-ink-muted/70">Not set</span>;
  const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: getHomeTimeZone() });

  return (
    <>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-rex-700 hover:text-rex-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All clients
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-rex-950">
            {c.companyCode && <span className="font-mono tracking-wider">{c.companyCode}</span>}
            {c.companyCode && c.displayName && <span className="text-ink-muted"> · </span>}
            {c.displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StageBadge stage={c.lifecycleStage} />
            {c.implementationType && <Badge tone="neutral">{IMPLEMENTATION_TYPE_LABELS[c.implementationType]}</Badge>}
            {c.supportModel && <Badge tone="neutral">{SUPPORT_MODEL_LABELS[c.supportModel]}</Badge>}
            <FastStartBadge fastStart={c.fastStart} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientActions
            id={c.id}
            label={clientLabel(c)}
            stage={c.lifecycleStage}
            transitions={allowedTransitions(c.lifecycleStage)}
          />
        </div>
      </header>

      {justCreated && (
        <Alert tone="success" className="mb-6">
          {clientLabel(c)} was added as {c.lifecycleStage === "PROSPECT" ? "a prospect" : "an implementation"}.
        </Alert>
      )}
      {seatsEnded > 0 && (
        <Alert tone="info" className="mb-6">
          The support model changed, so {seatsEnded} assignment{seatsEnded === 1 ? "" : "s"} in seats it no longer has ended.
        </Alert>
      )}
      {missing.length > 0 && (
        <Alert tone="info" className="mb-6">
          Before this prospect can move to Implementation, fill in: {missing.join(", ")}.{" "}
          <Link href={`/clients/${c.id}/edit`} className="font-medium underline">Edit details</Link>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="mb-4 text-base font-semibold text-rex-950">Details</h2>
            <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-muted">Support model</dt>
              <dd>{c.supportModel ? `${SUPPORT_MODEL_LABELS[c.supportModel]} (${SUPPORT_MODEL_SEATS[c.supportModel]})` : notSet}</dd>
              <dt className="text-ink-muted">Implementation type</dt>
              <dd>{c.implementationType ? IMPLEMENTATION_TYPE_LABELS[c.implementationType] : notSet}</dd>
              <dt className="text-ink-muted">Previous vendor</dt>
              <dd>{c.previousVendor ? PREVIOUS_VENDOR_LABELS[c.previousVendor] : notSet}</dd>
              <dt className="text-ink-muted">Employees</dt>
              <dd className="tabular">{c.employeeCount?.toLocaleString() ?? notSet}</dd>
              <dt className="text-ink-muted">Controls</dt>
              <dd className="tabular">{c.controlCount ?? notSet}</dd>
              <dt className="text-ink-muted">Payroll complexity</dt>
              <dd>
                {c.payrollComplexity ? (
                  <>
                    <span className="tabular font-medium">{c.payrollComplexity}</span>
                    <span className="text-ink-muted"> · {complexityScale[c.payrollComplexity - 1]}</span>
                  </>
                ) : notSet}
              </dd>
              <dt className="text-ink-muted">Time zone</dt>
              <dd>{c.timeZone ? `${timeZoneLabel(c.timeZone)} (${c.timeZone})` : notSet}</dd>
            </dl>
            {c.notes && <p className="mt-5 border-t border-rex-900/8 pt-4 text-sm whitespace-pre-line text-ink">{c.notes}</p>}
          </Card>

          <Card>
            <CardHeader icon={<CalendarClock />} title="Key dates" description="Counted in business days: weekdays minus your holiday list." />
            <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-muted">First input</dt>
              <dd>
                {c.firstInputDate ? (
                  <>
                    <span className="tabular font-medium">{formatDate(c.firstInputDate, { withWeekday: true })}</span>
                    {c.businessDaysToFirstInput !== null && (
                      <span className="text-ink-muted"> · {relativeBusinessDays(c.businessDaysToFirstInput)}</span>
                    )}
                  </>
                ) : notSet}
              </dd>
              <dt className="text-ink-muted">Benefits start</dt>
              <dd>
                {c.benefitsStartDate ? (
                  <>
                    <span className="tabular">{formatDate(c.benefitsStartDate, { withWeekday: true })}</span>
                    {c.benefitsOffset !== null && (
                      <span className="text-ink-muted">
                        {" · "}
                        {c.benefitsOffset === 0
                          ? "same day as first input"
                          : `${Math.abs(c.benefitsOffset)} business day${Math.abs(c.benefitsOffset) === 1 ? "" : "s"} ${c.benefitsOffset > 0 ? "after" : "before"} first input`}
                      </span>
                    )}
                  </>
                ) : notSet}
              </dd>
              <dt className="text-ink-muted">Fast start</dt>
              <dd>
                {c.fastStart === null
                  ? <span className="text-ink-muted/70">Needs a first input date</span>
                  : c.fastStart.kind === "fixed"
                    ? c.fastStart.isFastStart ? "Yes, based on the assignment date" : "No, based on the assignment date"
                    : c.fastStart.isFastStart
                      ? "Yes, if assigned today (under 20 business days to first input)"
                      : "No, if assigned today"}
              </dd>
            </dl>
          </Card>

          <TeamCard client={c} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Scale />} title="Workload weight" />
            <p className="tabular text-3xl font-semibold text-rex-950">
              {c.weight.total.toFixed(2)}
              {c.weight.incomplete && <span className="ml-1 text-base font-normal text-ink-muted">so far</span>}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-ink-muted">
              {c.weight.parts.map((p) => (
                <li key={p.label} className="flex justify-between gap-2">
                  <span>{p.label}</span>
                  <span className="tabular">+{p.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {c.lifecycleStage === "SERVICE" && (
              <p className="mt-3 text-xs text-ink-muted">In service: not counted toward capacity.</p>
            )}
          </Card>

          <Card>
            <CardHeader icon={<History />} title="Stage history" />
            <ol className="relative space-y-4 border-l border-rex-200 pl-5">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-rex-500 ring-4 ring-white/80" aria-hidden="true" />
                  <p className="text-sm font-medium text-rex-950">
                    {h.fromStage ? `${STAGE_LABELS[h.fromStage]} to ${STAGE_LABELS[h.toStage]}` : `Added as ${STAGE_LABELS[h.toStage]}`}
                  </p>
                  <p className="tabular text-xs text-ink-muted">{dateTime.format(h.changedAt)}</p>
                  {h.note && h.note !== "Created" && <p className="mt-1 text-sm text-ink">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>

          <ComingSoon className="max-w-none" phase={6} icon={<AlertTriangle />} title="Escalations" points={["Escalations for this client"]} />
        </div>
      </div>
    </>
  );
}
