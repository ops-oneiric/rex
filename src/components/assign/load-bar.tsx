import { BAND_LABELS, type Band } from "@/lib/assignments/rules";
import { cn } from "@/lib/utils";

const bandColor: Record<Band, string> = {
  AVAILABLE: "bg-emerald-500",
  HEALTHY: "bg-rex-600",
  FULL: "bg-amber-500",
  OVER: "bg-red-600",
};
const bandText: Record<Band, string> = {
  AVAILABLE: "text-emerald-800",
  HEALTHY: "text-rex-800",
  FULL: "text-amber-800",
  OVER: "text-red-800",
};

/**
 * Horizontal load bar. `before` is the current load; `after` (optional) shows what a new
 * assignment would add as a lighter segment. The tick marks the associate's target.
 */
export function LoadBar({
  before,
  after,
  target,
  band,
  scaleMax = 12,
  showLabel = true,
  className,
}: {
  before: number;
  after?: number;
  target: number;
  band: Band;
  scaleMax?: number;
  showLabel?: boolean;
  className?: string;
}) {
  // An "after" equal to "before" adds nothing to show.
  if (after !== undefined && Math.abs(after - before) < 0.005) after = undefined;
  const max = Math.max(scaleMax, after ?? before, target) * 1.05;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const added = after !== undefined ? Math.max(0, after - before) : 0;
  const shown = after ?? before;

  return (
    <div className={cn("min-w-36", className)}>
      {showLabel && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="tabular text-ink">
            {after !== undefined ? (
              <>
                {before.toFixed(1)} <span className="text-ink-muted">to</span> <span className="font-semibold">{after.toFixed(1)}</span>
              </>
            ) : (
              <span className="font-semibold">{before.toFixed(1)}</span>
            )}
            <span className="text-ink-muted"> / {target}</span>
          </span>
          <span className={cn("font-medium", bandText[band])}>{BAND_LABELS[band]}</span>
        </div>
      )}
      <div
        className="relative h-2 overflow-hidden rounded-full bg-rex-900/8"
        role="img"
        aria-label={`Load ${shown.toFixed(1)} against a target of ${target}: ${BAND_LABELS[band]}`}
      >
        <div className={cn("absolute inset-y-0 left-0 rounded-full", bandColor[band])} style={{ width: pct(before) }} />
        {added > 0 && (
          <div
            className={cn("absolute inset-y-0 rounded-r-full opacity-45", bandColor[band])}
            style={{ left: pct(before), width: pct(added) }}
          />
        )}
        <div className="absolute inset-y-0 w-0.5 bg-rex-950/50" style={{ left: pct(target) }} aria-hidden="true" />
      </div>
    </div>
  );
}
