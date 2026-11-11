"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { TrendContent } from "@/lib/cadence/data";
import { formatDate } from "@/lib/dates";
import { trendAction } from "@/app/(app)/cadence/actions";

const DIRECTION = {
  improving: "success",
  steady: "neutral",
  declining: "warning",
  mixed: "neutral",
  unclear: "neutral",
} as const;

export type TrendView = {
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  status: "DONE" | "FAILED";
  error: string | null;
  content: TrendContent | null;
  costUsd: number | null;
};

export function TrendCard({ associateId, report, hasKey, meetings }: { associateId: number; report: TrendView | null; hasKey: boolean; meetings: number }) {
  const [pending, start] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  const c = report?.status === "DONE" ? report.content : null;

  return (
    <Card>
      <CardHeader
        icon={<TrendingUp />}
        title="Trends"
        description={c ? `${formatDate(report!.periodStart)} to ${formatDate(report!.periodEnd)}, ${c.meetings} meetings` : "Patterns across the last 90 days of 1:1s."}
      />
      {c && (
        <div className="space-y-4 text-sm">
          <p className="text-ink">{c.overview}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={DIRECTION[c.morale_trajectory.direction]}>Morale {c.morale_trajectory.direction}</Badge>
            {c.stats.rate !== null && (
              <Badge tone="neutral" title={`${c.stats.done} done, ${c.stats.dropped} dropped, ${c.stats.open} open`}>
                {c.stats.rate}% follow-through
              </Badge>
            )}
          </div>
          <p className="text-xs text-ink-muted">{c.morale_trajectory.detail}</p>
          {c.recurring_themes.length > 0 && (
            <Section title="Recurring themes">
              {c.recurring_themes.map((t) => (
                <li key={t.theme}>
                  <span className="font-medium">{t.theme}:</span> {t.detail}
                </li>
              ))}
            </Section>
          )}
          {c.skill_growth.length > 0 && <Section title="Skills growing">{c.skill_growth.map((s) => <li key={s}>{s}</li>)}</Section>}
          {c.persistent_weak_points.length > 0 && (
            <Section title="Persistent growth areas">{c.persistent_weak_points.map((s) => <li key={s}>{s}</li>)}</Section>
          )}
          <p className="text-ink">{c.follow_through}</p>
          {c.talking_points.length > 0 && (
            <div className="rounded-xl bg-rex-100/60 p-3 ring-1 ring-rex-300/40">
              <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-rex-800 uppercase">Talking points for the next 1:1</h4>
              <ol className="list-decimal space-y-1 pl-4 text-ink">
                {c.talking_points.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {report?.status === "FAILED" && !error && <Alert tone="error">The last report failed: {report.error}</Alert>}
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      {hasKey ? (
        <Button
          className="mt-4"
          variant={c ? "secondary" : "primary"}
          disabled={pending || meetings < 2}
          onClick={() =>
            start(async () => {
              setError(null);
              setElapsed(0);
              const r = await trendAction(associateId);
              if (!r.ok) setError(r.message ?? "The report failed.");
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          {pending ? `Analyzing... ${elapsed}s` : c ? "Refresh report" : "Generate report"}
        </Button>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">Needs a Claude API key in Settings.</p>
      )}
      {hasKey && meetings < 2 && <p className="mt-2 text-xs text-ink-muted">Log at least two 1:1s to see trends.</p>}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">{title}</h4>
      <ul className="list-disc space-y-1 pl-4 text-ink">{children}</ul>
    </div>
  );
}
