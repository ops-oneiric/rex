import "server-only";
import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { allLoads, assignmentQueue, firstInputTimeline } from "@/lib/assignments/data";
import { listRoster } from "@/lib/associates/data";
import { cadenceOverview } from "@/lib/cadence/data";
import { clientContext, listClients, withFacts } from "@/lib/clients/data";
import {
  clientLabel,
  IMPLEMENTATION_TYPE_LABELS,
  type ImplementationType,
  STAGE_LABELS,
  STAGES,
  SUPPORT_MODEL_LABELS,
  SUPPORT_MODELS,
} from "@/lib/clients/constants";
import { addDays, todayIn } from "@/lib/dates";
import { escalationStats, listEscalations, toListItems } from "@/lib/escalations/data";
import { aiUsageSince } from "@/lib/ai/usage";
import { getHomeTimeZone, getRuleSettings } from "@/lib/settings";
import {
  countBuckets,
  DURATION_BUCKETS,
  implementationSpans,
  LEAD_TIME_BUCKETS,
  leadTimes,
  loadOnDates,
  median,
  percent,
  ptoConflicts,
  type StageEvent,
  weekStarts,
} from "./metrics";

const { assignments, associates, associatePto, clientStageHistory, aiRecommendations, escalations } = schema;

/** Stage history per client, oldest first, as calendar dates in your time zone. */
function stageHistories(): Map<number, StageEvent[]> {
  const tz = getHomeTimeZone();
  const out = new Map<number, StageEvent[]>();
  const rows = db.select().from(clientStageHistory).orderBy(asc(clientStageHistory.changedAt), asc(clientStageHistory.id)).all();
  for (const r of rows) out.set(r.clientId, [...(out.get(r.clientId) ?? []), { on: todayIn(tz, r.changedAt), to: r.toStage }]);
  return out;
}

/** Upcoming PTO conflicts on clients each associate holds right now. */
export function currentPtoConflicts() {
  const ctx = clientContext();
  const facts = new Map(withFacts(listClients(), ctx).map((c) => [c.id, c]));
  const held = db
    .select({ associateId: assignments.associateId, associateName: associates.name, clientId: assignments.clientId, seat: assignments.seat })
    .from(assignments)
    .innerJoin(associates, eq(associates.id, assignments.associateId))
    .where(eq(assignments.status, "ACTIVE"))
    .all()
    .flatMap((r) => {
      const c = facts.get(r.clientId);
      if (!c || c.lifecycleStage === "SERVICE") return [];
      return [{ ...r, clientLabel: clientLabel(c), firstInputDate: c.firstInputDate, benefitsStartDate: c.benefitsStartDate }];
    });
  const pto = db.select().from(associatePto).all();
  return ptoConflicts(held, pto, { today: ctx.today, holidays: ctx.holidays, rules: getRuleSettings() });
}

/* ------------------------------------------ Dashboard ------------------------------------------ */

export function dashboardData() {
  const ctx = clientContext();
  const todayIso = ctx.today;
  const facts = withFacts(listClients(), ctx);
  const implementations = facts.filter((c) => c.lifecycleStage === "IMPLEMENTATION");
  const queue = assignmentQueue().implementations;
  const loads = allLoads();
  const roster = listRoster(todayIso).filter((a) => a.isActive);
  const capacity = roster
    .map((a) => ({ id: a.id, name: a.name, targetLoad: a.targetLoad, load: loads.get(a.id)! }))
    .sort((a, b) => b.load.projected - a.load.projected);

  const conflicts = currentPtoConflicts();
  const horizon = addDays(todayIso, 30);
  const names = new Map(roster.map((a) => [a.id, a.name]));
  const conflictPtoIds = new Set(conflicts.map((c) => c.ptoId));
  const pto = db
    .select()
    .from(associatePto)
    .orderBy(asc(associatePto.startDate))
    .all()
    .filter((p) => names.has(p.associateId) && p.endDate >= todayIso && (p.startDate <= horizon || conflictPtoIds.has(p.id)))
    .map((p) => ({ ...p, associateName: names.get(p.associateId)!, conflicts: conflicts.filter((c) => c.ptoId === p.id) }));

  const cadence = cadenceOverview();
  const oneOnOnes = cadence.rows
    .filter((r) => r.status !== "ON_TRACK")
    .sort((a, b) => {
      const rank = { OVERDUE: 0, NEVER: 1, DUE_SOON: 2, ON_TRACK: 3 } as const;
      return rank[a.status] - rank[b.status] || (b.daysSince ?? 0) - (a.daysSince ?? 0);
    });

  const escalationItems = toListItems(listEscalations());
  const openEscalations = escalationItems.filter((e) => e.status === "OPEN");
  const needsReview = escalationItems.filter((e) => !e.confirmed).length;

  return {
    today: todayIso,
    stats: {
      awaiting: queue.length,
      fastStartsAwaiting: queue.filter((c) => c.fastStart?.isFastStart).length,
      implementations: implementations.length,
      firstInputs30: implementations.filter((c) => c.firstInputDate && c.firstInputDate >= todayIso && c.firstInputDate <= horizon).length,
      openEscalations: openEscalations.length,
      needsReview,
    },
    queue: queue.slice(0, 6).map((c) => ({
      id: c.id,
      label: clientLabel(c),
      firstInputDate: c.firstInputDate,
      fastStart: c.fastStart?.isFastStart ?? false,
      filled: c.filled,
      seats: c.seats.length,
    })),
    capacity,
    timeline: firstInputTimeline(60),
    conflicts,
    pto,
    cadenceFrequency: cadence.frequency,
    oneOnOnes,
    managesAnyone: cadence.rows.length > 0,
    myItems: cadence.myOpenItems,
    openEscalations: openEscalations.slice(0, 5),
  };
}

/* ------------------------------------------- Insights ------------------------------------------- */

export const INSIGHT_RANGES = [
  { id: "90", days: 90, label: "3 months" },
  { id: "180", days: 180, label: "6 months" },
  { id: "365", days: 365, label: "12 months" },
] as const;

export function insightsData(days: number) {
  const ctx = clientContext();
  const rules = getRuleSettings();
  const todayIso = ctx.today;
  const from = addDays(todayIso, -days);
  const facts = withFacts(listClients(), ctx);
  const byId = new Map(facts.map((c) => [c.id, c]));
  const histories = stageHistories();

  /* Capacity over time: team load each Monday vs. the active team's combined target. */
  // Each Monday in the period, with today standing in for this week so the last point is current.
  const weeks = weekStarts(from, todayIso);
  weeks[weeks.length - 1] = todayIso;
  const rows = db.select().from(assignments).all();
  const loadClients = new Map(
    facts.map((c) => [c.id, { supportModel: c.supportModel, weight: c.weight.total, history: histories.get(c.id) ?? [] }]),
  );
  const loadSeries = loadOnDates(weeks, rows, loadClients, rules);
  const roster = db.select().from(associates).where(eq(associates.isActive, true)).all();
  const teamTarget = Math.round(roster.reduce((s, a) => s + a.targetLoad, 0) * 10) / 10;
  const loadNow = loadSeries.at(-1)?.load ?? 0;

  /* First input density: next 26 weeks of known first inputs (implementations and prospects). */
  const ahead = weekStarts(todayIso, addDays(todayIso, 26 * 7 - 1));
  const upcoming = facts.filter((c) => c.lifecycleStage !== "SERVICE" && c.firstInputDate && c.firstInputDate >= todayIso);
  const density = ahead.map((w) => {
    const inWeek = upcoming.filter((c) => c.firstInputDate! >= w && c.firstInputDate! <= addDays(w, 6));
    return {
      week: w,
      count: inWeek.length,
      prospects: inWeek.filter((c) => c.lifecycleStage === "PROSPECT").length,
    };
  });

  /* Fast starts and lead time: clients first assigned in the period. */
  const assignedInRange = facts.filter((c) => c.assignedOn && c.assignedOn >= from && c.assignedOn <= todayIso && c.firstInputDate);
  const fastStarts = assignedInRange.filter((c) => c.fastStart?.isFastStart);
  const leads = leadTimes(assignedInRange, ctx.holidays);
  const fastByType = (["NEW_LOGO", "ADD_CONTROL"] as ImplementationType[]).map((t) => {
    const group = assignedInRange.filter((c) => c.implementationType === t);
    return { key: t, label: IMPLEMENTATION_TYPE_LABELS[t], value: group.filter((c) => c.fastStart?.isFastStart).length, of: group.length };
  });

  /* Book of business. */
  const active = facts.filter((c) => c.lifecycleStage === "IMPLEMENTATION");
  const bySupportModel = SUPPORT_MODELS.map((m) => ({ key: m, label: SUPPORT_MODEL_LABELS[m], value: active.filter((c) => c.supportModel === m).length }));
  const byStage = STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s], value: facts.filter((c) => c.lifecycleStage === s).length }));

  /* Implementation durations: completed in the period. */
  const spans = facts.flatMap((c) =>
    implementationSpans(histories.get(c.id) ?? [])
      .filter((s) => s.end >= from)
      .map((s) => ({ ...s, clientId: c.id, implementationType: c.implementationType, supportModel: c.supportModel })),
  );
  const durationByType = (["NEW_LOGO", "ADD_CONTROL"] as ImplementationType[]).flatMap((t) => {
    const m = median(spans.filter((s) => s.implementationType === t).map((s) => s.days));
    return m === null ? [] : [{ key: t, label: IMPLEMENTATION_TYPE_LABELS[t], value: Math.round(m) }];
  });

  /* Escalations. */
  const esc = escalationStats(days);
  const confirmed = db
    .select({ clientId: escalations.clientId })
    .from(escalations)
    .where(and(isNotNull(escalations.confirmedAt), gte(escalations.occurredOn, from)))
    .all();
  const withClient = confirmed.map((e) => (e.clientId ? byId.get(e.clientId) : undefined)).filter((c) => !!c);
  const everImplemented = facts.filter((c) => c.lifecycleStage !== "PROSPECT");
  const escByType = (["NEW_LOGO", "ADD_CONTROL"] as ImplementationType[]).map((t) => ({
    key: t,
    label: IMPLEMENTATION_TYPE_LABELS[t],
    value: withClient.filter((c) => c.implementationType === t).length,
    clients: everImplemented.filter((c) => c.implementationType === t).length,
  }));
  const escByStart = [
    { key: "fast", label: "Fast start", match: true },
    { key: "normal", label: "Normal start", match: false },
  ].map(({ key, label, match }) => ({
    key,
    label,
    value: withClient.filter((c) => c.fastStart?.kind === "fixed" && c.fastStart.isFastStart === match).length,
    clients: everImplemented.filter((c) => c.fastStart?.kind === "fixed" && c.fastStart.isFastStart === match).length,
  }));

  /* Claude's recommendations. */
  const since = new Date(Date.parse(`${from}T00:00:00Z`));
  const recs = db
    .select({ outcome: aiRecommendations.outcome, status: aiRecommendations.status })
    .from(aiRecommendations)
    .where(gte(aiRecommendations.createdAt, since))
    .orderBy(desc(aiRecommendations.createdAt))
    .all()
    .filter((r) => r.status === "COMPLETED");
  const outcome = (o: string) => recs.filter((r) => r.outcome === o).length;
  const decided = outcome("ACCEPTED") + outcome("MODIFIED") + outcome("REJECTED");
  const manualInRange = db
    .select({ source: assignments.source, overrideNote: assignments.overrideNote })
    .from(assignments)
    .where(gte(assignments.startDate, from))
    .all();

  return {
    from,
    to: todayIso,
    capacity: { series: loadSeries, teamTarget, loadNow, utilization: percent(loadNow, teamTarget), activeAssociates: roster.length },
    density,
    fast: {
      assigned: assignedInRange.length,
      fastStarts: fastStarts.length,
      rate: percent(fastStarts.length, assignedInRange.length),
      medianLead: median(leads),
      leadBuckets: countBuckets(leads, LEAD_TIME_BUCKETS),
      byType: fastByType,
    },
    book: { bySupportModel, byStage, activeCount: active.length },
    durations: {
      count: spans.length,
      median: median(spans.map((s) => s.days)),
      buckets: countBuckets(
        spans.map((s) => s.days),
        DURATION_BUCKETS,
      ),
      byType: durationByType,
    },
    escalations: { stats: esc, byType: escByType, byStart: escByStart },
    ai: {
      total: recs.length,
      decided,
      accepted: outcome("ACCEPTED"),
      modified: outcome("MODIFIED"),
      rejected: outcome("REJECTED"),
      pending: outcome("PENDING"),
      acceptance: percent(outcome("ACCEPTED") + outcome("MODIFIED"), decided),
      overrides: manualInRange.filter((a) => a.overrideNote).length,
      assignments: manualInRange.length,
      costUsd: aiUsageSince(since).totalCostUsd,
    },
  };
}
