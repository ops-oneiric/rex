"use client";

import { ColumnChart } from "./column-chart";

const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Escalations per month (YYYY-MM keys), drawn with the shared column chart. */
export function MonthColumns({ data, height = 140 }: { data: { month: string; count: number }[]; height?: number }) {
  const at = (iso: string) => new Date(`${iso}-01T00:00:00Z`);
  return (
    <ColumnChart
      label="Escalations per month"
      valueLabel="Escalations"
      height={height}
      data={data.map((d) => ({ key: d.month, label: monthName.format(at(d.month)), title: monthLong.format(at(d.month)), value: d.count }))}
    />
  );
}
