import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Scale, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { evaluateSeat, getTeam } from "@/lib/assignments/data";
import { clientNeeds } from "@/lib/assignments/rules";
import { SEATS, SEATS_BY_MODEL, seatLabel, type Seat } from "@/lib/assignments/seats";
import { requireAdmin } from "@/lib/auth/dal";
import { clientLabel, STAGE_LABELS, SUPPORT_MODEL_LABELS } from "@/lib/clients/constants";
import { getClient, clientContext } from "@/lib/clients/data";
import { toRuleClient } from "@/lib/assignments/data";
import { formatDate } from "@/lib/dates";
import { FastStartBadge, relativeBusinessDays } from "../../clients/badges";
import { CandidateList } from "./candidate-list";
import { RecommendationPanel, type SeatOptions } from "./recommendation-panel";
import { buildInputForClient, getRecommendation, listRecommendations, RecommendationError } from "@/lib/ai/recommend/service";
import { MODELS } from "@/lib/ai/models";
import { getAiModel, getApiKeyStatus } from "@/lib/settings";

const OUTCOME_LABELS = {
  PENDING: "No decision",
  ACCEPTED: "Accepted",
  MODIFIED: "Accepted with changes",
  REJECTED: "Declined",
} as const;

export const metadata = { title: "Assign" };

export default async function AssignSeatPage({ params, searchParams }: PageProps<"/assign/[clientId]">) {
  await requireAdmin();
  const row = getClient(Number((await params).clientId));
  if (!row) notFound();
  const back = (
    <Link href={`/clients/${row.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-rex-700 hover:text-rex-900">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to {clientLabel(row)}
    </Link>
  );
  if (!row.supportModel || row.lifecycleStage === "SERVICE") {
    return (
      <>
        {back}
        <PageHeader title={`Assign team: ${clientLabel(row)}`} />
        <Alert tone="info">
          {row.lifecycleStage === "SERVICE"
            ? "This client is in Service, so it no longer takes assignments."
            : "Set a support model on this client first. It decides which seats the team has."}
        </Alert>
      </>
    );
  }

  const seats = SEATS_BY_MODEL[row.supportModel];
  const team = getTeam(row);
  const sp = await searchParams;
  const requested = sp.seat;
  const seat: Seat =
    SEATS.includes(requested as Seat) && seats.includes(requested as Seat)
      ? (requested as Seat)
      : (team.find((t) => !t.assignment)?.seat ?? seats[0]!);
  const evaluation = evaluateSeat(row.id, seat)!;
  const { client, candidates, current } = evaluation;
  const ctx = clientContext();
  const needs = clientNeeds(toRuleClient(client, ctx.today), ctx.holidays);
  const nextUnfilled = team.find((t) => !t.assignment && t.seat !== seat)?.seat ?? null;
  const isProspect = client.lifecycleStage === "PROSPECT";

  // Claude recommendation: the options for each open seat, and which recommendation to show.
  let blockedReason: string | null = null;
  let seatOptions: SeatOptions = [];
  try {
    seatOptions = buildInputForClient(client.id).openSeats.map((s) => ({
      seat: s.seat,
      label: seatLabel(s.seat, client.supportModel),
      options: s.candidates
        .filter((c) => c.status === "eligible")
        .map((c) => ({ associateId: c.associateId, name: c.name, score: c.score, loadAfter: c.loadAfter, targetLoad: c.targetLoad })),
    }));
    if (seatOptions.every((s) => s.options.length === 0)) blockedReason = "No associate is eligible for the open seats yet.";
  } catch (error) {
    if (!(error instanceof RecommendationError)) throw error;
    blockedReason = `${error.message} Recommendations are for open seats.`;
  }
  const history = listRecommendations(client.id);
  const requestedRec = Number(sp.rec);
  const latest = history[0];
  const recommendation =
    requestedRec && history.some((h) => h.id === requestedRec)
      ? getRecommendation(requestedRec)
      : latest && latest.outcome === "PENDING"
        ? getRecommendation(latest.id)
        : null;
  const modelLabel = MODELS.find((m) => m.id === getAiModel())?.label ?? "Claude";

  return (
    <>
      {back}
      <PageHeader
        title={`${isProspect ? "Hold associates" : "Assign team"}: ${clientLabel(client)}`}
        description={
          isProspect
            ? "This client is a prospect. Assignments here are holds: they show as projected load only, and become the real team when the client moves to Implementation."
            : "Candidates are ranked by the rules engine. Knock-outs and flags are shown so every choice is informed."
        }
      />

      <div className="glass mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4 text-rex-500" aria-hidden="true" />
          {client.firstInputDate ? (
            <>
              First input <span className="tabular font-medium">{formatDate(client.firstInputDate, { withWeekday: true })}</span>
              {client.businessDaysToFirstInput !== null && (
                <span className="text-ink-muted">({relativeBusinessDays(client.businessDaysToFirstInput)})</span>
              )}
            </>
          ) : (
            <span className="text-ink-muted">No first input date: PTO and collision checks are skipped</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Scale className="size-4 text-rex-500" aria-hidden="true" />
          Weight <span className="tabular font-medium">{client.weight.total.toFixed(2)}</span>
        </span>
        <Badge tone="neutral">{SUPPORT_MODEL_LABELS[client.supportModel!]}</Badge>
        <Badge tone="neutral">{STAGE_LABELS[client.lifecycleStage]}</Badge>
        <FastStartBadge fastStart={client.fastStart} />
        {needs.length > 0 && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <ShieldCheck className="size-4 text-rex-500" aria-hidden="true" />
            <span className="text-ink-muted">Needs</span>
            {needs.map((n) => (
              <Badge key={n} tone="primary">{n}</Badge>
            ))}
          </span>
        )}
      </div>

      <RecommendationPanel
        clientId={client.id}
        hasKey={getApiKeyStatus().configured}
        modelLabel={modelLabel}
        blockedReason={blockedReason}
        seatOptions={seatOptions}
        recommendation={recommendation}
      />

      <Tabs
        label="Seats"
        active={seat}
        items={team.map((t) => ({
          id: t.seat,
          label: `${seatLabel(t.seat, client.supportModel)}: ${t.assignment?.associateName ?? "Unfilled"}`,
          href: `/assign/${client.id}?seat=${t.seat}`,
        }))}
      />

      <CandidateList
        clientId={client.id}
        seat={seat}
        seatName={seatLabel(seat, client.supportModel)}
        current={current ? { id: current.id, associateId: current.associateId, name: current.associateName, startDate: current.startDate } : null}
        candidates={candidates}
        nextHref={nextUnfilled ? `/assign/${client.id}?seat=${nextUnfilled}` : `/clients/${client.id}`}
      />

      {history.length > 0 && (
        <details className="glass mt-6 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-rex-950 select-none">
            Recommendation history ({history.length})
          </summary>
          <ul className="mt-3 divide-y divide-rex-900/6 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/assign/${client.id}?rec=${h.id}`} className="font-medium text-rex-950 hover:underline">
                  {formatDate(h.createdAt.toISOString().slice(0, 10))}
                </Link>
                <span className="text-xs text-ink-muted">
                  {h.status === "FAILED" ? "Failed" : OUTCOME_LABELS[h.outcome]}
                  {h.outcomeReason && ` · ${h.outcomeReason}`}
                  {` · ${h.model}`}
                  {h.costUsd !== null && ` · about $${h.costUsd.toFixed(3)}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
