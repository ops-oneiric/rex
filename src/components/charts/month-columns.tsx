"use client";

import { useState } from "react";

const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Columns per month, one series. Columns <= 24px with a 4px rounded top and a square
 * baseline, a hairline baseline, only the peak labelled, and a tooltip on hover/focus.
 * A table view sits underneath for screen readers and exact values.
 */
export function MonthColumns({ data, height = 140 }: { data: { month: string; count: number }[]; height?: number }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const peak = data.reduce((p, d) => (d.count > p.count ? d : p), data[0] ?? { month: "", count: 0 });
  const at = (iso: string) => new Date(`${iso}-01T00:00:00Z`);

  return (
    <div>
      <div className="flex items-end gap-1 border-b border-rex-900/15" style={{ height }} role="list" aria-label="Escalations per month">
        {data.map((d) => {
          const isPeak = d.month === peak.month && d.count > 0;
          return (
            <div
              key={d.month}
              role="listitem"
              tabIndex={0}
              aria-label={`${monthLong.format(at(d.month))}: ${d.count}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none focus-visible:ring-2 focus-visible:ring-rex-500"
              onMouseEnter={() => setActive(d.month)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(d.month)}
              onBlur={() => setActive(null)}
            >
              {isPeak && <span className="tabular mb-1 text-xs text-ink">{d.count}</span>}
              <span
                className="w-full max-w-6 rounded-t-[4px] bg-rex-600 transition-opacity group-hover:opacity-85"
                style={{ height: `${d.count ? Math.max((d.count / max) * (height - 24), 3) : 0}px` }}
                aria-hidden="true"
              />
              {active === d.month && (
                <span role="tooltip" className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg bg-rex-950 px-2.5 py-1 text-xs whitespace-nowrap text-white shadow-lg">
                  {monthLong.format(at(d.month))}: {d.count}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1" aria-hidden="true">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[11px] text-ink-muted">
            {monthName.format(at(d.month))}
          </span>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted select-none">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-ink-muted">
              <th scope="col" className="py-1 font-medium">Month</th>
              <th scope="col" className="py-1 text-right font-medium">Escalations</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-rex-900/6">
                <td className="py-1">{monthLong.format(at(d.month))}</td>
                <td className="tabular py-1 text-right">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
