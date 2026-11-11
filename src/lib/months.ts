/** Fills in empty months between two dates so gaps in time read as zero, not as missing columns. */
export function fillMonths(data: { month: string; count: number }[], from: string, to: string) {
  const out: { month: string; count: number }[] = [];
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  let y = fy!;
  let m = fm!;
  while (y < ty! || (y === ty && m <= tm!)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ month: key, count: data.find((d) => d.month === key)?.count ?? 0 });
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
  }
  return out;
}
