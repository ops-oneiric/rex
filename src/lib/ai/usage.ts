import "server-only";
import { and, gte, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { usageSince } from "@/lib/ai/recommend/service";

/** Every Claude call Rex made since a date, with estimated spend. */
export function aiUsageSince(since: Date) {
  const recommendations = usageSince(since);
  const insights = db
    .select({ cost: schema.cadenceEntries.insightCostUsd })
    .from(schema.cadenceEntries)
    .where(and(isNotNull(schema.cadenceEntries.analyzedAt), gte(schema.cadenceEntries.analyzedAt, since)))
    .all();
  const trends = db
    .select({ cost: schema.trendReports.costUsd })
    .from(schema.trendReports)
    .where(gte(schema.trendReports.createdAt, since))
    .all();
  const escalationRows = db
    .select({ cost: schema.escalations.costUsd })
    .from(schema.escalations)
    .where(and(isNotNull(schema.escalations.analyzedAt), gte(schema.escalations.analyzedAt, since)))
    .all();
  const sum = (rows: { cost: number | null }[]) => rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  return {
    recommendations,
    insights: insights.length,
    escalations: escalationRows.length,
    trends: trends.length,
    totalCostUsd: recommendations.costUsd + sum(insights) + sum(escalationRows) + sum(trends),
  };
}
