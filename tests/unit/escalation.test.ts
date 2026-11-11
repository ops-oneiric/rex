import { describe, expect, it } from "vitest";
import { decodeSuggestion, type EscalationOutput, escalationMessage, escalationTrendMessage } from "@/lib/ai/escalation/core";
import { aliasFor, buildAliasMap, scrubText } from "@/lib/privacy/alias";

const subjects = {
  clients: [{ id: 1, companyCode: "ACM", displayName: "Acme", label: "ACM · Acme" }],
  associates: [
    { id: 10, name: "Jordan Lee" },
    { id: 11, name: "Sam Patel" },
  ],
};
const map = buildAliasMap(subjects, () => 0.3);
const acm = aliasFor(map, "CLIENT", 1);
const jordan = aliasFor(map, "ASSOC", 10);
const sam = aliasFor(map, "ASSOC", 11);

const output: EscalationOutput = {
  summary: `${acm}'s first payroll was short for 12 employees.`,
  client: acm,
  associates_involved: [jordan, "ASSOC_99", acm],
  category: "PAYROLL_ERROR",
  severity: "HIGH",
  fault_party: "ASSOCIATE",
  fault_associates: [sam],
  fault_rationale: `${sam} keyed the wrong rate table.`,
  root_cause: "No second check on rate tables before the first payroll.",
  preventable: "YES",
  recommended_actions: [
    { text: `Add a rate table check to ${acm}'s go-live list`, owner: "me" },
    { text: "  ", owner: "associate" },
  ],
  cautions: [],
};

describe("escalation privacy", () => {
  it("never sends names or codes", () => {
    const coded = scrubText("ACM called: Jordan Lee missed the rate change; Sam told jlee@x.com.", subjects, map);
    const message = escalationMessage({ occurredOn: "2026-11-10", codedDetails: coded, mentioned: { clients: [], associates: [] } });
    for (const secret of ["ACM", "Acme", "Jordan", "Sam", "jlee@x.com"]) expect(message).not.toContain(secret);
    expect(message).toContain("[REDACTED_EMAIL]");
    expect(message).toContain("category: PAYROLL_ERROR");
  });
});

describe("decodeSuggestion", () => {
  const s = decodeSuggestion(output, map);

  it("resolves aliases to ids and drops unknown or wrong-kind aliases", () => {
    expect(s.clientId).toBe(1);
    expect(s.associateIds.sort()).toEqual([10, 11]);
    expect(s.faultAssociateIds).toEqual([11]);
  });

  it("decodes text for display and drops empty actions", () => {
    expect(s.summary).toBe("ACM · Acme's first payroll was short for 12 employees.");
    expect(s.faultRationale).toBe("Sam Patel keyed the wrong rate table.");
    expect(s.actions).toEqual([{ text: "Add a rate table check to ACM · Acme's go-live list", owner: "ME" }]);
  });

  it("ignores fault associates unless fault lies with an associate", () => {
    expect(decodeSuggestion({ ...output, fault_party: "CLIENT" }, map).faultAssociateIds).toEqual([]);
  });
});

describe("escalationTrendMessage", () => {
  it("includes the counts and each escalation in coded form", () => {
    const m = escalationTrendMessage({
      periodStart: "2026-05-14",
      periodEnd: "2026-11-10",
      total: 1,
      byCategory: [{ key: "PAYROLL_ERROR", label: "Payroll error", count: 1 }],
      byFault: [{ key: "ASSOCIATE", label: "Associate", count: 1 }],
      bySeverity: [{ key: "HIGH", label: "High", count: 1 }],
      escalations: [
        {
          occurredOn: "2026-11-01",
          client: acm,
          associates: [{ alias: sam, atFault: true }],
          category: "PAYROLL_ERROR",
          severity: "HIGH",
          faultParty: "ASSOCIATE",
          preventable: "YES",
          rootCause: "No second check",
          implementationType: "NEW_LOGO",
          stage: "IMPLEMENTATION",
        },
      ],
    });
    expect(m).toContain("1 confirmed escalation");
    expect(m).toContain("By category: Payroll error 1");
    expect(m).toContain(`${sam} (at fault)`);
    expect(m).toContain("(implementation, NEW_LOGO)");
  });
});
