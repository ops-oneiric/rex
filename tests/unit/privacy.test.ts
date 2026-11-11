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
