import { ListTodo } from "lucide-react";
import { ActionItemList, AddItemForm, type ItemView } from "@/components/cadence/action-items";
import { AnalysisPoller } from "@/components/cadence/analysis-poller";
import { EntryCard } from "@/components/cadence/entry-card";
import { NewEntryForm } from "@/components/cadence/new-entry-form";
import { TrendCard } from "@/components/cadence/trend-card";
import { Card, CardHeader } from "@/components/ui/card";
import { isAnalysisStale, latestTrend, listEntries, listItems } from "@/lib/cadence/data";
import { formatDate } from "@/lib/dates";
import { getApiKeyStatus, today } from "@/lib/settings";

export function CadenceTab({ associateId }: { associateId: number }) {
  const entries = listEntries(associateId);
  const items = listItems(associateId);
  const trend = latestTrend(associateId);
  const hasKey = getApiKeyStatus().configured;
  const dateOf = new Map(entries.map((e) => [e.id, formatDate(e.occurredOn)]));

  const toView = (i: (typeof items)[number]): ItemView => ({
    id: i.id,
    text: i.text,
    owner: i.owner,
    dueHint: i.dueHint,
    status: i.status,
    sourceDate: i.sourceType === "CADENCE" && i.sourceId ? dateOf.get(i.sourceId) ?? null : null,
  });
  const openItems = items.filter((i) => i.status === "OPEN").map(toView);
  const closedCount = items.length - openItems.length;
  const views = entries.map((e) => ({
    id: e.id,
    occurredOn: e.occurredOn,
    notes: e.notes,
    analysisStatus: e.analysisStatus,
    analysisError: e.analysisError,
    insight: e.insight,
    stale: isAnalysisStale(e),
  }));
  const analyzing = views.some((v) => v.analysisStatus === "PENDING" && !v.stale);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
      <AnalysisPoller active={analyzing} />
      <div className="min-w-0 space-y-6">
        <NewEntryForm associateId={associateId} today={today()} hasKey={hasKey} />
        {views.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            items={items.filter((i) => i.sourceType === "CADENCE" && i.sourceId === entry.id).map(toView)}
            openItems={openItems}
          />
        ))}
      </div>
      <div className="space-y-6">
        <Card role="region" aria-label="Open action items">
          <CardHeader
            icon={<ListTodo />}
            title="Open action items"
            description={closedCount ? `${closedCount} done or dropped.` : undefined}
          />
          <ActionItemList items={openItems} emptyText="Nothing open." />
          <AddItemForm associateId={associateId} />
        </Card>
        <TrendCard
          associateId={associateId}
          hasKey={hasKey}
          meetings={entries.length}
          report={
            trend
              ? {
                  createdAt: trend.createdAt.toISOString(),
                  periodStart: trend.periodStart,
                  periodEnd: trend.periodEnd,
                  status: trend.status,
                  error: trend.error,
                  content: trend.content,
                  costUsd: trend.costUsd,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
