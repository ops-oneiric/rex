/**
 * The privacy layer (plan Section 7). Before anything is sent to Claude, company codes,
 * client names and associate names are replaced with aliases such as CLIENT_03 and
 * ASSOC_07, and structured identifiers (emails, phone numbers, SSNs, EINs, long digit
 * strings) are redacted. The alias map never leaves the server.
 */

export type AliasKind = "CLIENT" | "ASSOC";

export type AliasEntry = {
  alias: string;
  kind: AliasKind;
  id: number;
  /** Display label used when mapping the alias back, e.g. "ACM · Acme" or "Jordan Lee". */
  label: string;
};

export type AliasMap = { entries: AliasEntry[] };

export type PrivacySubjects = {
  clients: { id: number; companyCode: string | null; displayName: string | null; label: string }[];
  associates: { id: number; name: string }[];
  /** Extra names from Settings (e.g. client contacts). Replaced with [NAME]. */
  extraNames?: string[];
};

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Assigns aliases in a random order, so alias numbers reveal nothing about the records. */
export function buildAliasMap(subjects: PrivacySubjects, random: () => number = Math.random): AliasMap {
  const pad = (n: number) => String(n).padStart(2, "0");
  const clients = shuffle(subjects.clients, random).map((c, i) => ({
    alias: `CLIENT_${pad(i + 1)}`,
    kind: "CLIENT" as const,
    id: c.id,
    label: c.label,
  }));
  const associates = shuffle(subjects.associates, random).map((a, i) => ({
    alias: `ASSOC_${pad(i + 1)}`,
    kind: "ASSOC" as const,
    id: a.id,
    label: a.name,
  }));
  return { entries: [...clients, ...associates] };
}

export function aliasFor(map: AliasMap, kind: AliasKind, id: number): string {
  const e = map.entries.find((x) => x.kind === kind && x.id === id);
  if (!e) throw new Error(`No alias for ${kind} ${id}`);
  return e.alias;
}

export function resolveAlias(map: AliasMap, alias: string): AliasEntry | undefined {
  return map.entries.find((e) => e.alias === alias);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Rule = { pattern: RegExp; replacement: string; length: number };

/** Builds the replacement rules: longest phrases first, so "Jordan Lee" wins over "Jordan". */
function dictionaryRules(subjects: PrivacySubjects, map: AliasMap): Rule[] {
  const rules: Rule[] = [];
  const add = (phrase: string | null | undefined, replacement: string, flags: string) => {
    const p = phrase?.trim();
    if (!p || p.length < 2) return;
    // Word boundaries that also work next to punctuation and non-ASCII letters.
    rules.push({ pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(p)}(?![\\p{L}\\p{N}_])`, `gu${flags}`), replacement, length: p.length });
  };

  for (const c of subjects.clients) {
    const alias = aliasFor(map, "CLIENT", c.id);
    // Company codes: uppercase whole words only, so ordinary words such as "and" are untouched.
    if (c.companyCode) add(c.companyCode, alias, "");
    add(c.displayName, alias, "i");
  }
  for (const a of subjects.associates) {
    const alias = aliasFor(map, "ASSOC", a.id);
    add(a.name, alias, "i");
    // First and last names alone: only as capitalized words (proper nouns), to spare
    // ordinary words such as "will" or "may".
    for (const part of a.name.split(/\s+/).filter((p) => p.length >= 3 && /^\p{Lu}/u.test(p))) {
      add(part.replace(/[.,]$/, ""), alias, "");
    }
  }
  for (const n of subjects.extraNames ?? []) add(n, "[NAME]", "i");
  return rules.sort((x, y) => y.length - x.length);
}

const PATTERNS: Rule[] = [
  { pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replacement: "[REDACTED_EMAIL]", length: 0 },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED_SSN]", length: 0 },
  { pattern: /\b\d{2}-\d{7}\b/g, replacement: "[REDACTED_EIN]", length: 0 },
  { pattern: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g, replacement: "[REDACTED_PHONE]", length: 0 },
  { pattern: /\b\d{9,}\b/g, replacement: "[REDACTED_NUMBER]", length: 0 },
];

/** Replaces structured identifiers and every known name or code in free text. */
export function scrubText(text: string, subjects: PrivacySubjects, map: AliasMap): string {
  let out = text;
  for (const rule of PATTERNS) out = out.replace(rule.pattern, rule.replacement);
  for (const rule of dictionaryRules(subjects, map)) out = out.replace(rule.pattern, rule.replacement);
  return out;
}

/** Maps aliases in Claude's text back to real labels, for display on the server only. */
export function unaliasText(text: string, map: AliasMap): string {
  return text.replace(/\b(?:CLIENT|ASSOC)_\d{2,}\b/g, (alias) => resolveAlias(map, alias)?.label ?? alias);
}
