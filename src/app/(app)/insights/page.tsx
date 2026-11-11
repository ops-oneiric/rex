import Link from "next/link";
import { ArrowRight, BarChart3, CalendarRange, Clock, Gauge, ShieldAlert, Sparkles, Timer, Zap } from "lucide-react";
import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { MonthColumns } from "@/components/charts/month-columns";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { fillMonths } from "@/lib/months";
import { INSIGHT_RANGES, insightsData } from "@/lib/insights/data";

export const metadata = { title: "Insights" };

const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4" aria-label={title}>
      <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, note, icon: Icon }: { label: string; value: string; note?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">{label}</span>
        <Icon className="size-4 text-rex-500" aria-hidden="true" />
      </div>
      <p className="tabular mt-3 text-3xl font-semibold text-rex-950">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </Card>
  );
}

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  await requireAdmin();
  const requested = (await searchParams).range;
  const range = INSIGHT_RANGES.find((r) => r.id === requested) ?? INSIGHT_RANGES[1];
  const d = insightsData(range.days);
  const dash = (n: number | null, suffix = "") => (n === null ? "–" : `${n}${suffix}`);

  const loadData = d.capacity.series.map((p, i, all) => ({
    key: p.date,
    label: short.format(at(p.date)),
    title: i === all.length - 1 ? `Today, ${formatDate(p.date)}` : `Week of ${formatDate(p.date)}`,
    value: p.load,
    note: `${p.accounts} implementation${p.accounts === 1 ? "" : "s"}`,
  }));
  const densityData = d.density.map((w) => ({
    key: w.week,
    label: short.format(at(w.week)),
    title: `Week of ${formatDate(w.week)}`,
    value: w.count,
    note: w.prospects ? `${w.prospects} prospect${w.prospects === 1 ? "" : "s"}` : undefined,
  }));
  const busiest = Math.max(0, ...d.density.map((w) => w.count));

  return (
    <>
      <PageHeader title="Insights" description="Trends across capacity, assignments, implementations and escalations." />
      <Tabs
        label="Period"
        active={range.id}
        items={INSIGHT_RANGES.map((r) => ({ id: r.id, label: r.label, href: `/insights?range=${r.id}` }))}
      />
      <p className="-mt-2 mb-6 text-sm text-ink-muted">
        {formatDate(d.from)} to {formatDate(d.to)}. First input density looks ahead 26 weeks instead.
      </p>

      <div className="space-y-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Team load now"
            value={d.capacity.utilization === null ? "–" : `${d.capacity.utilization}%`}
            note={`${d.capacity.loadNow} of ${d.capacity.teamTarget} target across ${d.capacity.activeAssociates} active associates`}
            icon={Gauge}
          />
          <Tile label="Fast start rate" value={dash(d.fast.rate, "%")} note={`${d.fast.fastStarts} of ${d.fast.assigned} clients assigned in the period`} icon={Zap} />
          <Tile
            label="Median implementation"
            value={d.durations.median === null ? "–" : `${Math.round(d.durations.median)} days`}
            note={`${d.durations.count} moved to Service in the period`}
            icon={Timer}
          />
          <Tile
            label="Claude's teams accepted"
            value={dash(d.ai.acceptance, "%")}
            note={`${d.ai.accepted + d.ai.modified} of ${d.ai.decided} decided recommendations`}
            icon={Sparkles}
          />
        </div>

        <Section title="Capacity">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<Gauge />}
                title="Team load by week"
                description="Weighted load across Implementation clients each Monday. The dashed line is the combined target of today's active associates; weights use each client's current details."
              />
              <ColumnChart
                label="Team load by week"
                valueLabel="Load"
                data={loadData}
                decimals={1}
                emphasize="last"
                labelEvery={Math.ceil(loadData.length / 7)}
                reference={{ value: d.capacity.teamTarget, label: `Target ${d.capacity.teamTarget}` }}
              />
            </Card>
            <Card>
              <CardHeader
                icon={<CalendarRange />}
                title="First inputs per week, next 26 weeks"
                description={`Known first input dates for implementations and prospects. The busiest week has ${busiest}.`}
              />
              <ColumnChart label="First inputs per week" valueLabel="First inputs" data={densityData} labelEvery={4} />
            </Card>
          </div>
        </Section>

        <Section title="Assignments">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<Clock />}
                title="Assignment to first input"
                description={`Business days of runway for clients assigned in the period${d.fast.medianLead !== null ? `; median ${d.fast.medianLead}` : ""}. Under 20 is a fast start.`}
              />
              <BarList total={d.fast.assigned} data={d.fast.leadBuckets.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
            </Card>
            <Card>
              <CardHeader icon={<Zap />} title="Fast starts by implementation type" description="Clients assigned in the period." />
              <BarList data={d.fast.byType.map((t) => ({ key: t.key, label: t.label, value: t.value, note: `of ${t.of} assigned` }))} />
            </Card>
            <Card>
              <CardHeader icon={<BarChart3 />} title="Active implementations by support model" description={`${d.book.activeCount} in Implementation today.`} />
              <BarList data={d.book.bySupportModel} />
            </Card>
            <Card>
              <CardHeader icon={<BarChart3 />} title="Clients by stage" description="Everyone in Rex today." />
              <BarList data={d.book.byStage} />
            </Card>
          </div>
        </Section>

        <Section title="Implementations">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<Timer />}
                title="Implementation duration"
                description="Calendar days from entering Implementation to moving to Service, for clients that moved in the period."
              />
              <BarList data={d.durations.buckets.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
            </Card>
            <Card>
              <CardHeader icon={<Timer />} title="Median days by implementation type" description="Same clients as the duration chart." />
              <BarList unit=" days" data={d.durations.byType} />
            </Card>
          </div>
        </Section>

        <Section title="Escalations">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<CalendarRange />}
                title="Escalations per month"
                description={`${d.escalations.stats.total} confirmed in the period.`}
                action={
                  <Link href="/escalations?tab=trends" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-rex-700 hover:text-rex-900">
                    Trends
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                }
              />
              <MonthColumns data={fillMonths(d.escalations.stats.byMonth, d.escalations.stats.periodStart, d.escalations.stats.periodEnd)} />
            </Card>
            <Card>
              <CardHeader icon={<ShieldAlert />} title="By fault" />
              <BarList total={d.escalations.stats.total} data={d.escalations.stats.byFault.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
            </Card>
            <Card>
              <CardHeader
                icon={<ShieldAlert />}
                title="By implementation type"
                description="Confirmed escalations with a client. The tooltip shows how many clients of each type you have had."
              />
              <BarList data={d.escalations.byType.map((t) => ({ key: t.key, label: t.label, value: t.value, note: `${t.clients} clients` }))} />
            </Card>
            <Card>
              <CardHeader
                icon={<Zap />}
                title="Fast start vs. normal start"
                description="Confirmed escalations by how the client's implementation started."
              />
              <BarList data={d.escalations.byStart.map((t) => ({ key: t.key, label: t.label, value: t.value, note: `${t.clients} clients` }))} />
            </Card>
          </div>
        </Section>

        <Section title="Claude">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={<Sparkles />}
                title="Recommendation outcomes"
                description={`${d.ai.total} team recommendation${d.ai.total === 1 ? "" : "s"} in the period.`}
              />
              <BarList
                total={d.ai.total}
                data={[
                  { key: "accepted", label: "Accepted as is", value: d.ai.accepted },
                  { key: "modified", label: "Accepted with changes", value: d.ai.modified },
                  { key: "rejected", label: "Declined", value: d.ai.rejected },
                  { key: "pending", label: "Not decided", value: d.ai.pending },
                ]}
              />
            </Card>
            <Card>
              <CardHeader icon={<Gauge />} title="Rules and spend" />
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-ink-muted">Assignments made</dt>
                  <dd className="tabular mt-1 text-xl font-semibold text-rex-950">{d.ai.assignments}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Knock-out overridden</dt>
                  <dd className="tabular mt-1 text-xl font-semibold text-rex-950">{d.ai.overrides}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Claude spend, estimated</dt>
                  <dd className="tabular mt-1 text-xl font-semibold text-rex-950">${d.ai.costUsd.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Decided recommendations</dt>
                  <dd className="tabular mt-1 text-xl font-semibold text-rex-950">{d.ai.decided}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </Section>
      </div>
    </>
  );
}
