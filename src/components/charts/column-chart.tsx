"use client";

import { useState } from "react";

export type ColumnDatum = {
  key: string;
  /** Short axis label, e.g. "Nov" or "11/3". */
  label: string;
  /** Full label for the tooltip and table, e.g. "Week of Nov 3, 2025". */
  title: string;
  value: number;
  note?: string;
};

/**
 * One series of columns over time. Columns <= 24px with a 4px rounded top and a square
 * baseline, a hairline baseline, one direct label (the peak or the latest value), an
 * optional dashed reference line, and a tooltip on hover/focus. A table view sits
 * underneath for screen readers and exact values. The card title names the series.
 */
export function ColumnChart({
  data,
  label,
  valueLabel,
  height = 140,
  decimals = 0,
  labelEvery = 1,
  emphasize = "peak",
  reference,
}: {
  data: ColumnDatum[];
  label: string;
  valueLabel: string;
  height?: number;
  decimals?: number;
  labelEvery?: number;
  emphasize?: "peak" | "last";
  reference?: { value: number; label: string };
}) {
  const [active, setActive] = useState<string | null>(null);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const max = Math.max(...data.map((d) => d.value), reference?.value ?? 0, 1);
  const plot = height - 24;
  const marked =
    emphasize === "last" ? data.at(-1) : data.reduce<ColumnDatum | undefined>((p, d) => (!p || d.value > p.value ? d : p), undefined);

  return (
    <div>
      <div className="relative">
        {reference && reference.value > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-rex-900/35"
            style={{ bottom: `${(reference.value / max) * plot}px` }}
            aria-hidden="true"
          >
            <span className="absolute right-0 -translate-y-full pb-0.5 text-[11px] text-ink-muted">{reference.label}</span>
          </div>
        )}
        <div className="flex items-end gap-1 border-b border-rex-900/15" style={{ height }} role="list" aria-label={label}>
          {data.map((d) => {
            const isMarked = marked?.key === d.key && d.value > 0;
            return (
              <div
                key={d.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.title}: ${fmt(d.value)}${d.note ? `, ${d.note}` : ""}`}
                className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end outline-none focus-visible:ring-2 focus-visible:ring-rex-500"
                onMouseEnter={() => setActive(d.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.key)}
                onBlur={() => setActive(null)}
              >
                {isMarked && <span className="tabular mb-1 text-xs whitespace-nowrap text-ink">{fmt(d.value)}</span>}
                <span
                  className="w-full max-w-6 rounded-t-[4px] bg-rex-600 transition-opacity group-hover:opacity-85"
                  style={{ height: `${d.value ? Math.max((d.value / max) * plot, 3) : 0}px` }}
                  aria-hidden="true"
                />
                {active === d.key && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg bg-rex-950 px-2.5 py-1 text-xs whitespace-nowrap text-white shadow-lg"
                  >
                    {d.title}: {fmt(d.value)}
                    {d.note && ` · ${d.note}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-1" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 text-center text-[11px] whitespace-nowrap text-ink-muted">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted select-none">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-1 font-medium">Period</th>
              <th scope="col" className="py-1 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-rex-900/6">
                <td className="py-1">
                  {d.title}
                  {d.note && <span className="text-ink-muted"> · {d.note}</span>}
                </td>
                <td className="tabular py-1 text-right">{fmt(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
