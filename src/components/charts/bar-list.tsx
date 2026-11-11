"use client";

import Link from "next/link";
import { useState } from "react";

export type BarDatum = { key: string; label: string; value: number; href?: string; note?: string };

/**
 * A single-series horizontal bar chart for counts by category. One hue (validated against
 * the surface), bars <= 24px with a 4px rounded data end and a square baseline, values as
 * text beside each bar, and a hover/focus tooltip with the share of the total. The title of
 * the surrounding card names the series, so there is no legend.
 */
export function BarList({ data, total, unit = "" }: { data: BarDatum[]; total?: number; unit?: string }) {
  const [active, setActive] = useState<string | null>(null);
  if (data.length === 0) return <p className="text-sm text-ink-muted">Nothing to show yet.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const sum = total ?? data.reduce((s, d) => s + d.value, 0);

  return (
    <ul className="space-y-2">
      {data.map((d) => {
        const share = sum ? Math.round((d.value / sum) * 100) : 0;
        const label = d.href ? (
          <Link href={d.href} className="truncate hover:underline">
            {d.label}
          </Link>
        ) : (
          <span className="truncate">{d.label}</span>
        );
        return (
          <li
            key={d.key}
            className="group relative grid grid-cols-[minmax(6rem,10rem)_1fr_2.5rem] items-center gap-3 rounded-lg py-0.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rex-500"
            tabIndex={0}
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(d.key)}
            onBlur={() => setActive(null)}
            aria-label={`${d.label}: ${d.value}${unit}${sum ? `, ${share}% of ${sum}` : ""}`}
          >
            <span className="flex min-w-0 text-ink">{label}</span>
            <span className="relative h-3.5">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-rex-600 transition-opacity group-hover:opacity-85"
                style={{ width: `${Math.max((d.value / max) * 100, 1.5)}%` }}
                aria-hidden="true"
              />
            </span>
            <span className="tabular text-right text-ink">{d.value}</span>
            {active === d.key && (
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-8 left-40 z-10 rounded-lg bg-rex-950 px-2.5 py-1 text-xs whitespace-nowrap text-white shadow-lg"
              >
                {d.label}: {d.value}
                {unit} · {share}% of {sum}
                {d.note && ` · ${d.note}`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
