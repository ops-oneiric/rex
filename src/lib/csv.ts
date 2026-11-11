/**
 * CSV for spreadsheets. Cells that start with = + - @ (or a tab/carriage return) are
 * prefixed with an apostrophe so Excel and Sheets show them as text instead of running
 * them as formulas (CSV injection). Numbers are left alone.
 */
export type Cell = string | number | boolean | null | undefined;

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  // Byte order mark so Excel opens UTF-8 correctly; CRLF line ends per RFC 4180.
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
