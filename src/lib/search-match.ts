/** Matching for the command palette. Pure, so it runs in the browser and in unit tests. */

export type Searchable = { label: string; keywords?: string; detail?: string };

/**
 * Items whose text contains every word of the query, best first: an exact company code or
 * name, then labels that start with the query, then words that start with it, then the rest.
 * Ties keep their original order.
 */
export function rankMatches<T extends Searchable>(items: T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  const words = q.split(/\s+/);
  const scored: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const label = item.label.toLowerCase();
    const keywords = (item.keywords ?? "").toLowerCase();
    const haystack = `${label} ${keywords} ${(item.detail ?? "").toLowerCase()}`;
    if (!words.every((w) => haystack.includes(w))) return;
    const tokens = `${label} ${keywords}`.split(/[\s·,]+/).filter(Boolean);
    let score = 3;
    if (tokens.includes(q) || label === q) score = 0;
    else if (label.startsWith(q)) score = 1;
    else if (tokens.some((t) => t.startsWith(words[0]!))) score = 2;
    scored.push({ item, score, i });
  });
  return scored
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.item);
}
