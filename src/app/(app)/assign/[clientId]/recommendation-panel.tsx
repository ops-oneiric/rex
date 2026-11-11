"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, Eye, Loader2, RefreshCw, ShieldCheck, Sparkles, ThumbsDown } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import type { RecommendationView } from "@/lib/ai/recommend/service";
import type { Seat } from "@/lib/assignments/seats";
import { cn } from "@/lib/utils";
import { acceptTeamAction, previewAction, recommendAction, rejectRecommendationAction } from "../actions";

export type SeatOption = { associateId: number; name: string; score: number; loadAfter: number; targetLoad: number };
export type SeatOptions = { seat: Seat; label: string; options: SeatOption[] }[];

type Props = {
  clientId: number;
  hasKey: boolean;
  modelLabel: string;
  /** Why a recommendation can't be requested right now, if it can't. */
  blockedReason: string | null;
  seatOptions: SeatOptions;
  recommendation: RecommendationView | null;
};

const FACTOR_LABELS = {
  pto: "PTO",
  collisions: "First input collisions",
  capacity: "Capacity",
  capability: "Capability fit",
  time_zone: "Time zone",
} as const;

const OUTCOME_TEXT = {
  ACCEPTED: "You accepted this recommendation.",
  MODIFIED: "You accepted this recommendation with changes.",
  REJECTED: "You declined this recommendation.",
} as const;

export function RecommendationPanel({ clientId, hasKey, modelLabel, blockedReason, seatOptions, recommendation }: Props) {
  const router = useRouter();
  const [running, startRun] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const ask = () =>
    startRun(async () => {
      setError(null);
      setElapsed(0);
      const result = await recommendAction(clientId);
      if (result.recommendationId) router.push(`/assign/${clientId}?rec=${result.recommendationId}`);
      if (!result.ok) setError(result.message ?? "The request failed.");
    });

  const showRec = recommendation && recommendation.status === "COMPLETED";

  return (
    <Card className="mb-6 border-rex-300/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rex-900 text-white">
            <Sparkles className="size-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-rex-950">Recommend a team with Claude</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
              Claude reads the same facts as the ranked list below and proposes up to three complete teams for the open seats.
              Names and company codes are replaced with codes before anything is sent.
            </p>
          </div>
        </div>
        {hasKey && !blockedReason && (
          <Button onClick={ask} disabled={running} variant={showRec ? "secondary" : "primary"}>
            {running ? <Loader2 className="animate-spin" aria-hidden="true" /> : showRec ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {running ? `Asking Claude... ${elapsed}s` : showRec ? "Ask again" : "Recommend team"}
          </Button>
        )}
      </div>

      {!hasKey && (
        <Alert tone="info" className="mt-4">
          Save your Claude API key in <Link href="/settings?tab=claude" className="font-medium underline">Settings</Link> to get
          recommendations. The ranked list below works without it.
        </Alert>
      )}
      {hasKey && blockedReason && <Alert tone="info" className="mt-4">{blockedReason}</Alert>}
      {running && (
        <p className="mt-4 text-sm text-ink-muted" aria-live="polite">
          {modelLabel} is weighing the candidates. This usually takes 20 to 90 seconds.
        </p>
      )}
      {error && !running && <Alert tone="error" className="mt-4">{error}</Alert>}

      {hasKey && !blockedReason && !showRec && (
        <details
          className="mt-4"
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open && !preview) {
              startPreview(async () => {
                const r = await previewAction(clientId);
                setPreview(r.ok ? r.payload ?? "" : r.message ?? "Preview unavailable.");
              });
            }
          }}
        >
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-rex-700 select-none">
            <Eye className="size-4" aria-hidden="true" />
            Preview what will be sent
          </summary>
          <PayloadBlock text={previewing ? "Building preview..." : preview ?? ""} />
        </details>
      )}

      {recommendation?.status === "FAILED" && !running && !error && (
        <Alert tone="error" className="mt-4">The last request failed: {recommendation.error}</Alert>
      )}

      {showRec && <RecommendationBody rec={recommendation} seatOptions={seatOptions} />}
    </Card>
  );
}

function RecommendationBody({ rec, seatOptions }: { rec: RecommendationView; seatOptions: SeatOptions }) {
  const decided = rec.outcome !== "PENDING";
  const meta = [
    rec.servedModel ?? rec.model,
    rec.durationMs ? `${Math.round(rec.durationMs / 1000)} s` : null,
    rec.costUsd !== null ? `about $${rec.costUsd.toFixed(3)}` : null,
    rec.promptVersion,
  ].filter(Boolean);

  return (
    <div className="mt-5 space-y-4">
      {rec.summary && <p className="text-sm text-ink">{rec.summary}</p>}
      {rec.cautions.length > 0 && (
        <Alert tone="info">
          <ul className="list-disc space-y-0.5 pl-4">
            {rec.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Alert>
      )}
      {decided && (
        <Alert tone="success">
          {OUTCOME_TEXT[rec.outcome as keyof typeof OUTCOME_TEXT]}
          {rec.outcomeReason && ` Reason: ${rec.outcomeReason}`}
        </Alert>
      )}
      {!decided && !rec.stillApplicable && (
        <Alert tone="info">The team has changed since this recommendation, so it can no longer be applied. Ask again for a fresh one.</Alert>
      )}
      {rec.teams.length === 0 ? (
        <p className="text-sm text-ink-muted">Claude did not return a team that fits the rules.</p>
      ) : (
        <ol className="space-y-3">
          {rec.teams.map((team) => (
            <TeamOption key={team.index} rec={rec} team={team} seatOptions={seatOptions} canApply={!decided && rec.stillApplicable} />
          ))}
        </ol>
      )}
      {!decided && rec.teams.length > 0 && <RejectForm recommendationId={rec.id} />}
      <details>
        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-muted select-none">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          What Claude received · {meta.join(" · ")}
        </summary>
        <PayloadBlock text={rec.requestPayload} />
      </details>
    </div>
  );
}

function TeamOption({
  rec,
  team,
  seatOptions,
  canApply,
}: {
  rec: RecommendationView;
  team: RecommendationView["teams"][number];
  seatOptions: SeatOptions;
  canApply: boolean;
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, number>>(() =>
    Object.fromEntries(team.members.map((m) => [m.seat, m.associateId])),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = team.members.some((m) => choices[m.seat] !== m.associateId);

  const accept = () =>
    start(async () => {
      const result = await acceptTeamAction({
        recommendationId: rec.id,
        teamIndex: team.index,
        choices: team.members.map((m) => ({ seat: m.seat, associateId: choices[m.seat]! })),
        reason: reason.trim() || null,
      });
      if (!result.ok) setError(result.message ?? "Could not assign the team.");
      else router.push(`/clients/${rec.clientId}`);
    });

  return (
    <li className={cn("rounded-xl bg-white/60 p-4 ring-1 ring-rex-900/10", team.index === 0 && "ring-2 ring-rex-500")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular grid size-7 place-items-center rounded-lg bg-rex-900 text-sm font-semibold text-white">{team.index + 1}</span>
        <span className="text-sm font-semibold text-rex-950">{team.index === 0 ? "Recommended team" : `Alternative ${team.index}`}</span>
        <span className="tabular rounded-full bg-rex-100 px-2 py-0.5 text-xs font-semibold text-rex-800">Fit {team.fitScore}</span>
        <Badge tone={team.confidence === "high" ? "success" : team.confidence === "medium" ? "neutral" : "warning"}>
          {team.confidence} confidence
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.members.map((m) => {
          const seat = seatOptions.find((s) => s.seat === m.seat);
          const picked = seat?.options.find((o) => o.associateId === choices[m.seat]);
          return (
            <div key={m.seat}>
              <Label htmlFor={`team${team.index}-${m.seat}`} className="text-xs tracking-wide text-ink-muted uppercase">
                {seat?.label ?? m.seat}
              </Label>
              {canApply && seat ? (
                <Select
                  id={`team${team.index}-${m.seat}`}
                  value={choices[m.seat]}
                  onChange={(e) => setChoices((c) => ({ ...c, [m.seat]: Number(e.target.value) }))}
                >
                  {seat.options.map((o) => (
                    <option key={o.associateId} value={o.associateId}>
                      {o.name}
                      {o.associateId === m.associateId ? " (Claude's pick)" : ""}
                    </option>
                  ))}
                </Select>
              ) : (
                <p id={`team${team.index}-${m.seat}`} className="text-sm font-medium text-rex-950">{m.name}</p>
              )}
              {picked && (
                <p className="tabular mt-1 text-xs text-ink-muted">
                  Rules score {picked.score} · load to {picked.loadAfter.toFixed(1)} of {picked.targetLoad}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-ink">{team.rationale}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[9rem_1fr]">
        {(Object.keys(FACTOR_LABELS) as (keyof typeof FACTOR_LABELS)[]).map((k) =>
          team.factors[k] ? (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{FACTOR_LABELS[k]}</dt>
              <dd className="text-ink">{team.factors[k]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {team.risks.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
          {team.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {canApply && (
        <div className="mt-4 space-y-2">
          {changed && (
            <div>
              <Label htmlFor={`reason${team.index}`}>Why the change? (optional)</Label>
              <Textarea
                id={`reason${team.index}`}
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Saved with the recommendation, to learn from later"
              />
            </div>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <Button onClick={accept} disabled={pending} variant={team.index === 0 ? "primary" : "secondary"}>
            <Check aria-hidden="true" />
            {pending ? "Assigning..." : changed ? "Accept with changes" : team.index === 0 ? "Accept team" : "Accept this team"}
          </Button>
        </div>
      )}
    </li>
  );
}

function RejectForm({ recommendationId }: { recommendationId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <ThumbsDown aria-hidden="true" />
        None of these
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl bg-white/50 p-4 ring-1 ring-rex-900/8">
      <Label htmlFor="rejectReason">What should Claude have done differently? (optional)</Label>
      <Textarea id="rejectReason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await rejectRecommendationAction(recommendationId, reason);
              setMessage(r.message ?? null);
              if (r.ok) router.refresh();
            })
          }
        >
          Decline recommendation
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {message && <p className="text-sm text-ink-muted">{message}</p>}
    </div>
  );
}

function PayloadBlock({ text }: { text: string }) {
  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-rex-950/90 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-rex-50">
      {text}
    </pre>
  );
}
