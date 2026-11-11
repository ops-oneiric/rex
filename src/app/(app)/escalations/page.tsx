import { BarChart3, CalendarRange, Gauge, ShieldAlert, Users } from "lucide-react";
import { BarList } from "@/components/charts/bar-list";
import { MonthColumns } from "@/components/charts/month-columns";
import { fillMonths } from "@/lib/months";
import { AnalysisPoller } from "@/components/cadence/analysis-poller";
import { EscalationList } from "@/components/escalations/escalation-list";
import { EscalationTrendCard } from "@/components/escalations/escalation-trend-card";
import { NewEscalationForm } from "@/components/escalations/new-escalation-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/dates";
import { escalationStats, latestEscalationTrend, listEscalations, toListItems } from "@/lib/escalations/data";
import { getApiKeyStatus, today } from "@/lib/settings";

export const metadata = { title: "Escalations" };

export default async function EscalationsPage({ searchParams }: PageProps<"/escalations">) {
  await requireAdmin();
  const tab = (await searchParams).tab === "trends" ? "trends" : "log";
  const hasKey = getApiKeyStatus().configured;
  const items = toListItems(listEscalations());
  const needsReview = items.filter((e) => !e.confirmed).length;

  return (
    <>
      <PageHeader title="Escalations" description="Log what happened, confirm Claude's review, and see patterns over time." />
      <Tabs
        label="Escalation views"
        active={tab}
        items={[
          { id: "log", label: "Log", href: "/escalations", count: needsReview || undefined },
          { id: "trends", label: "Trends", href: "/escalations?tab=trends" },
        ]}
      />
      {tab === "log" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[26rem_1fr]">
          <AnalysisPoller active={items.some((e) => e.analyzing)} />
          <div>
            <NewEscalationForm today={today()} hasKey={hasKey} />
          </div>
          <EscalationList items={items} />
        </div>
      ) : (
        <Trends hasKey={hasKey} />
      )}
    </>
  );
}

function Trends({ hasKey }: { hasKey: boolean }) {
  const stats = escalationStats(180);
  const report = latestEscalationTrend();
  const tiles = [
    { label: "Confirmed escalations", value: String(stats.total), icon: ShieldAlert },
    { label: "Awaiting your review", value: String(stats.unconfirmed), icon: Gauge },
    { label: "Preventable", value: stats.preventableShare === null ? "–" : `${stats.preventableShare}%`, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        {formatDate(stats.periodStart)} to {formatDate(stats.periodEnd)}. Counts include confirmed escalations only.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">{label}</span>
              <Icon className="size-4 text-rex-500" aria-hidden="true" />
            </div>
            <p className="tabular mt-3 text-3xl font-semibold text-rex-950">{value}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<CalendarRange />} title="Escalations per month" />
          <MonthColumns data={fillMonths(stats.byMonth, stats.periodStart, stats.periodEnd)} />
        </Card>
        <EscalationTrendCard
          hasKey={hasKey}
          confirmed={stats.total}
          report={report ? { periodStart: report.periodStart, periodEnd: report.periodEnd, status: report.status, error: report.error, content: report.content } : null}
        />
        <Card>
          <CardHeader icon={<BarChart3 />} title="By fault" />
          <BarList total={stats.total} data={stats.byFault.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
        </Card>
        <Card>
          <CardHeader icon={<BarChart3 />} title="By category" />
          <BarList total={stats.total} data={stats.byCategory.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
        </Card>
        <Card>
          <CardHeader icon={<BarChart3 />} title="By severity" />
          <BarList total={stats.total} data={stats.bySeverity.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
        </Card>
        <Card>
          <CardHeader icon={<BarChart3 />} title="Clients with the most escalations" />
          <BarList total={stats.total} data={stats.byClient.map((c) => ({ key: String(c.id), label: c.label, value: c.count, href: `/clients/${c.id}` }))} />
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            icon={<Users />}
            title="Associates at fault"
            description="Escalations where fault was confirmed as theirs. Involvement alone is shown in the tooltip, not counted against anyone."
          />
          <BarList
            data={stats.byAssociate
              .filter((a) => a.atFault > 0)
              .map((a) => ({ key: String(a.id), label: a.name, value: a.atFault, href: `/associates/${a.id}?tab=escalations`, note: `involved in ${a.involved}` }))}
          />
        </Card>
      </div>
    </div>
  );
}
