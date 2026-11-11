import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListTodo, ShieldCheck } from "lucide-react";
import { ActionItemList } from "@/components/cadence/action-items";
import { AnalysisPoller } from "@/components/cadence/analysis-poller";
import { FaultBadge, ReviewBadge, SeverityBadge, StatusBadge } from "@/components/escalations/badges";
import { DetailsCard, EscalationActions } from "@/components/escalations/escalation-controls";
import { ReviewForm, type ReviewValues } from "@/components/escalations/review-form";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/dal";
import { clientLabel } from "@/lib/clients/constants";
import { formatDate } from "@/lib/dates";
import { db, schema } from "@/lib/db";
import { escalationItems, getEscalationRow, isAnalysisStale } from "@/lib/escalations/data";

export const metadata = { title: "Escalation" };

export default async function EscalationPage({ params }: PageProps<"/escalations/[id]">) {
  await requireAdmin();
  const e = getEscalationRow(Number((await params).id));
  if (!e) notFound();

  const s = e.suggestion;
  const confirmed = !!e.confirmedAt;
  const stale = isAnalysisStale(e);
  const initial: ReviewValues = confirmed
    ? {
        clientId: e.clientId,
        summary: e.summary ?? "",
        associateIds: e.people.map((p) => p.associateId),
        faultAssociateIds: e.people.filter((p) => p.atFault).map((p) => p.associateId),
        category: e.category!,
        severity: e.severity!,
        faultParty: e.faultParty!,
        faultRationale: e.faultRationale ?? "",
        rootCause: e.rootCause ?? "",
        preventable: e.preventable ?? "UNCLEAR",
      }
    : s
      ? {
          clientId: s.clientId,
          summary: s.summary,
          associateIds: s.associateIds,
          faultAssociateIds: s.faultAssociateIds,
          category: s.category,
          severity: s.severity,
          faultParty: s.faultParty,
          faultRationale: s.faultRationale,
          rootCause: s.rootCause,
          preventable: s.preventable,
        }
      : {
          clientId: null,
          summary: "",
          associateIds: [],
          faultAssociateIds: [],
          category: "OTHER",
          severity: "MEDIUM",
          faultParty: "UNDETERMINED",
          faultRationale: "",
          rootCause: "",
          preventable: "UNCLEAR",
        };
  const clientOptions = db
    .select()
    .from(schema.clients)
    .all()
    .map((c) => ({ id: c.id, label: clientLabel(c) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const associateOptions = db
    .select({ id: schema.associates.id, name: schema.associates.name, isActive: schema.associates.isActive })
    .from(schema.associates)
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));
  const items = escalationItems(e.id);

  return (
    <>
      <AnalysisPoller active={e.analysisStatus === "PENDING" && !stale} />
      <Link href="/escalations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-rex-700 hover:text-rex-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All escalations
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-rex-950">
            Escalation, {formatDate(e.occurredOn)}
            {e.clientLabel && <span className="text-ink-muted"> · {e.clientLabel}</span>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            {confirmed && <SeverityBadge severity={e.severity} />}
            {confirmed && <FaultBadge fault={e.faultParty} />}
            <ReviewBadge confirmed={confirmed} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EscalationActions id={e.id} status={e.status} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-6">
          <DetailsCard
            id={e.id}
            occurredOn={e.occurredOn}
            details={e.details}
            analysis={{ status: e.analysisStatus, stale, error: e.analysisError }}
          />
          <ReviewForm
            key={`analysis-${e.analyzedAt?.getTime() ?? 0}`}
            escalationId={e.id}
            initial={initial}
            source={confirmed ? "confirmed" : s ? "suggestion" : "blank"}
            confirmedOn={e.confirmedAt ? formatDate(e.confirmedAt.toISOString().slice(0, 10)) : null}
            suggestedActions={!confirmed ? (s?.actions ?? []) : []}
            cautions={s?.cautions ?? []}
            clients={clientOptions}
            associates={associateOptions}
          />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader icon={<ListTodo />} title="Action items" />
            <ActionItemList
              emptyText={confirmed ? "None from this escalation." : "Suggested items are added when you confirm."}
              items={items.map((i) => ({ id: i.id, text: i.text, owner: i.owner, dueHint: i.dueHint, status: i.status }))}
            />
          </Card>
          {e.requestPayload && (
            <Card>
              <CardHeader
                icon={<ShieldCheck />}
                title="What Claude received"
                description={[e.aiModel, e.promptVersion, e.costUsd !== null ? `about $${e.costUsd.toFixed(3)}` : null].filter(Boolean).join(" · ")}
              />
              <pre className="max-h-96 overflow-auto rounded-xl bg-rex-950/90 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-rex-50">
                {e.requestPayload}
              </pre>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
