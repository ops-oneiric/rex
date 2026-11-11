import { describe, expect, it } from "vitest";
import { aliasFor, buildAliasMap, resolveAlias, scrubText, unaliasText } from "@/lib/privacy/alias";

const subjects = {
  clients: [
    { id: 1, companyCode: "ACM", displayName: "Acme Manufacturing", label: "ACM · Acme Manufacturing" },
    { id: 2, companyCode: "AND", displayName: null, label: "AND" },
  ],
  associates: [
    { id: 10, name: "Jordan Lee" },
    { id: 11, name: "Will May" },
  ],
  extraNames: ["Pat Contact"],
};
// Deterministic "random" for tests.
const map = buildAliasMap(subjects, () => 0.5);

describe("alias map", () => {
  it("gives every client and associate a unique alias", () => {
    const aliases = map.entries.map((e) => e.alias);
    expect(new Set(aliases).size).toBe(4);
    expect(aliases.filter((a) => a.startsWith("CLIENT_"))).toHaveLength(2);
    expect(aliases.filter((a) => a.startsWith("ASSOC_"))).toHaveLength(2);
    expect(resolveAlias(map, aliasFor(map, "ASSOC", 10))?.label).toBe("Jordan Lee");
  });
});

describe("scrubText", () => {
  const acm = aliasFor(map, "CLIENT", 1);
  const and = aliasFor(map, "CLIENT", 2);
  const jordan = aliasFor(map, "ASSOC", 10);
  const will = aliasFor(map, "ASSOC", 11);

  it("replaces codes, names, first and last names", () => {
    const out = scrubText("ACM (Acme Manufacturing) escalated. Jordan Lee and Lee's manager spoke to jordan lee.", subjects, map);
    expect(out).toBe(`${acm} (${acm}) escalated. ${jordan} and ${jordan}'s manager spoke to ${jordan}.`);
  });

  it("leaves ordinary words alone", () => {
    const out = scrubText("We will see and may decide. The acm meeting went well.", subjects, map);
    expect(out).toBe("We will see and may decide. The acm meeting went well.");
    expect(scrubText("AND is a client", subjects, map)).toBe(`${and} is a client`);
    expect(scrubText("Will May called; Will said yes.", subjects, map)).toBe(`${will} called; ${will} said yes.`);
  });

  it("redacts structured identifiers and extra names", () => {
    const out = scrubText(
      "Email jlee@example.com or call (555) 123-4567. SSN 123-45-6789, EIN 12-3456789, account 123456789012. Ask Pat Contact.",
      subjects,
      map,
    );
    expect(out).toBe(
      "Email [REDACTED_EMAIL] or call [REDACTED_PHONE]. SSN [REDACTED_SSN], EIN [REDACTED_EIN], account [REDACTED_NUMBER]. Ask [NAME].",
    );
  });

  it("round-trips through unaliasText", () => {
    const coded = scrubText("Jordan Lee is a strong fit for ACM.", subjects, map);
    expect(coded).not.toMatch(/Jordan|ACM/);
    expect(unaliasText(coded, map)).toBe("Jordan Lee is a strong fit for ACM · Acme Manufacturing.");
    expect(unaliasText("ASSOC_99 is unknown", map)).toBe("ASSOC_99 is unknown");
  });
});

describe("hyphenated company codes", () => {
  const hy = {
    clients: [
      { id: 1, companyCode: "A-1", displayName: null, label: "A-1" },
      { id: 2, companyCode: "BC-", displayName: null, label: "BC-" },
    ],
    associates: [],
  };
  const hyMap = buildAliasMap(hy, () => 0.5);
  const a1 = aliasFor(hyMap, "CLIENT", 1);
  const bc = aliasFor(hyMap, "CLIENT", 2);

  it("replaces them as whole codes, including at the end of a sentence", () => {
    expect(scrubText("A-1 went live; BC- is next. Call A-1's HR.", hy, hyMap)).toBe(`${a1} went live; ${bc} is next. Call ${a1}'s HR.`);
    expect(scrubText("Ask about BC-", hy, hyMap)).toBe(`Ask about ${bc}`);
  });

  it("leaves longer codes, dates and numbers that merely contain them alone", () => {
    expect(scrubText("XA-1 and A-12 and 2026-11-A-1x", hy, hyMap)).toBe("XA-1 and A-12 and 2026-11-A-1x");
    expect(scrubText("BC-7 is different", hy, hyMap)).toBe("BC-7 is different");
  });
});
