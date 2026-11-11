"use client";

import { useEffect, useState, useTransition } from "react";
import { Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { EscalationTrend } from "@/lib/ai/escalation/core";
import { formatDate } from "@/lib/dates";
import { escalationTrendAction } from "@/app/(app)/escalations/actions";

export type EscalationTrendView = {
  periodStart: string;
  periodEnd: string;
  status: "DONE" | "FAILED";
  error: string | null;
  content: EscalationTrend | null;
};

export function EscalationTrendCard({ report, hasKey, confirmed }: { report: EscalationTrendView | null; hasKey: boolean; confirmed: number }) {
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
        icon={<Lightbulb />}
        title="What the pattern says"
        description={c ? `Claude's reading of ${formatDate(report!.periodStart)} to ${formatDate(report!.periodEnd)}` : "Claude's reading of the confirmed escalations, with suggested process fixes."}
      />
      {c && (
        <div className="space-y-4 text-sm">
          <p className="text-ink">{c.overview}</p>
          {c.patterns.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">Patterns</h4>
              <ul className="list-disc space-y-1 pl-4 text-ink">
                {c.patterns.map((p) => (
                  <li key={p.pattern}>
                    <span className="font-medium">{p.pattern}:</span> {p.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.process_fixes.length > 0 && (
            <div className="rounded-xl bg-rex-100/60 p-3 ring-1 ring-rex-300/40">
              <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-rex-800 uppercase">Suggested process fixes</h4>
              <ol className="list-decimal space-y-1 pl-4 text-ink">
                {c.process_fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            </div>
          )}
          {c.watch_list.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium tracking-wide text-ink-muted uppercase">Worth watching</h4>
              <ul className="space-y-1 text-ink">
                {c.watch_list.map((w) => (
                  <li key={w.who}>
                    <span className="font-medium">{w.who}:</span> {w.reason}
                  </li>
                ))}
              </ul>
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
          disabled={pending || confirmed < 2}
          onClick={() =>
            start(async () => {
              setError(null);
              setElapsed(0);
              const r = await escalationTrendAction();
              if (!r.ok) setError(r.message ?? "The report failed.");
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          {pending ? `Analyzing... ${elapsed}s` : c ? "Refresh analysis" : "Analyze patterns"}
        </Button>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">Needs a Claude API key in Settings.</p>
      )}
      {hasKey && confirmed < 2 && <p className="mt-2 text-xs text-ink-muted">Confirm at least two escalations to analyze patterns.</p>}
    </Card>
  );
}
