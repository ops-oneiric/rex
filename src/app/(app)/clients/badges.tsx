import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, type Stage } from "@/lib/clients/constants";
import type { FastStart } from "@/lib/clients/derive";
import { formatDate } from "@/lib/dates";

const stageTone = { PROSPECT: "neutral", IMPLEMENTATION: "primary", SERVICE: "success" } as const;

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge tone={stageTone[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export function FastStartBadge({ fastStart }: { fastStart: FastStart }) {
  if (!fastStart?.isFastStart) return null;
  return (
    <Badge
      tone="warning"
      title={
        fastStart.kind === "fixed"
          ? "Fewer than 20 business days from assignment to first input"
          : "Fewer than 20 business days from today to first input"
      }
    >
      <Zap aria-hidden="true" />
      Fast start
    </Badge>
  );
}

/** "in 12 business days", "today", "3 business days ago". */
export function relativeBusinessDays(n: number): string {
  if (n === 0) return "today";
  const abs = Math.abs(n);
  const unit = `business day${abs === 1 ? "" : "s"}`;
  return n > 0 ? `in ${abs} ${unit}` : `${abs} ${unit} ago`;
}

export function FirstInput({ date, days }: { date: string | null; days: number | null }) {
  if (!date) return <span className="text-ink-muted/70">Not set</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular text-ink">{formatDate(date)}</span>
      {days !== null && <span className="block text-xs text-ink-muted">{relativeBusinessDays(days)}</span>}
    </span>
  );
}
