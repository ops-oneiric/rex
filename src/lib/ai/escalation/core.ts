/**
 * Escalation analysis and escalation trend reports. The details are scrubbed by the privacy
 * layer before this module sees them; Claude only ever sees aliases. No database access.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  CATEGORY_LABELS,
  ESCALATION_CATEGORIES,
  FAULT_LABELS,
  FAULT_PARTIES,
  PREVENTABLE,
  SEVERITIES,
  type EscalationCategory,
  type FaultParty,
  type Preventable,
  type Severity,
} from "@/lib/escalations/constants";
import { type AliasMap, resolveAlias, unaliasText } from "@/lib/privacy/alias";
import { callStructured, type StructuredResult } from "../structured";

/* --------------------------------------- Extraction --------------------------------------- */

export const ESCALATION_PROMPT_VERSION = "escalation-v1";

export const ESCALATION_SYSTEM = `You help a manager of payroll implementation associates review client escalations. You receive the manager's description of one escalation. Names and company codes have been replaced with aliases: CLIENT_xx for clients and ASSOC_xx for associates; [NAME] and [REDACTED_...] mark other removed details. You also receive what is known about the clients and associates mentioned, including who is on each client's team.

Return:
- summary: one or two sentences describing what happened.
- client: the alias of the client the escalation is about, or null if it is not clear.
- associates_involved: aliases of the associates involved.
- category: the best fit from the allowed values.
- severity: LOW (minor, no client impact), MEDIUM (client noticed, contained), HIGH (client harmed or upset, e.g. a wrong payroll), CRITICAL (employees not paid, legal or tax exposure, or the relationship at risk).
- fault_party: who mainly caused it. Use SHARED when fault is genuinely split and UNDETERMINED when the description does not say.
- fault_associates: aliases of associates at fault, only when fault_party is ASSOCIATE or SHARED and the description supports it.
- fault_rationale: why you aligned fault this way, citing the description. Be fair: do not blame an associate without evidence.
- root_cause: the underlying cause in one sentence, beyond the symptom.
- preventable: YES, NO or UNCLEAR.
- recommended_actions: up to three concrete next steps; owner "me" is the manager, "associate" is an associate.
- cautions: anything unclear or missing that limits the analysis.

Use only aliases that appear in the input. Do not guess identities behind aliases or redactions. Write in plain, professional English.`;

export const escalationSchema = z.object({
  summary: z.string(),
  client: z.string().nullable(),
  associates_involved: z.array(z.string()),
  category: z.enum(ESCALATION_CATEGORIES),
  severity: z.enum(SEVERITIES),
  fault_party: z.enum(FAULT_PARTIES),
  fault_associates: z.array(z.string()),
  fault_rationale: z.string(),
  root_cause: z.string(),
  preventable: z.enum(PREVENTABLE),
  recommended_actions: z.array(z.object({ text: z.string(), owner: z.enum(["me", "associate"]) })),
  cautions: z.array(z.string()),
});

export type EscalationOutput = z.infer<typeof escalationSchema>;

export type MentionedContext = {
  clients: { alias: string; stage: string; supportModel: string | null; implementationType: string | null; team: { alias: string; seat: string }[] }[];
  associates: { alias: string; seats: string }[];
};

export function escalationMessage(input: { occurredOn: string; codedDetails: string; mentioned: MentionedContext }): string {
  const clients = input.mentioned.clients.length
    ? input.mentioned.clients
        .map(
          (c) =>
            `- ${c.alias}: ${c.stage.toLowerCase()}, ${c.supportModel ?? "no support model"}, ${c.implementationType ?? "type unknown"}; team: ${
              c.team.length ? c.team.map((t) => `${t.alias} (${t.seat})`).join(", ") : "none"
            }`,
        )
        .join("\n")
    : "None mentioned.";
  const associates = input.mentioned.associates.length
    ? input.mentioned.associates.map((a) => `- ${a.alias}: ${a.seats}`).join("\n")
    : "None mentioned.";
  return [
    `## Escalation on ${input.occurredOn}`,
    input.codedDetails,
    "## Clients mentioned",
    clients,
    "## Associates mentioned",
    associates,
    "## Allowed values",
    `category: ${ESCALATION_CATEGORIES.join(", ")}\nseverity: ${SEVERITIES.join(", ")}\nfault_party: ${FAULT_PARTIES.join(", ")}\npreventable: ${PREVENTABLE.join(", ")}`,
  ].join("\n\n");
}

/** Claude's suggestion with aliases resolved to real ids and text decoded for display. */
export type EscalationSuggestion = {
  summary: string;
  clientId: number | null;
  associateIds: number[];
  faultAssociateIds: number[];
  category: EscalationCategory;
  severity: Severity;
  faultParty: FaultParty;
  faultRationale: string;
  rootCause: string;
  preventable: Preventable;
  actions: { text: string; owner: "ME" | "ASSOCIATE" }[];
  cautions: string[];
};

/** Resolves aliases, drops ones that don't exist or are the wrong kind, and decodes text. */
export function decodeSuggestion(output: EscalationOutput, map: AliasMap): EscalationSuggestion {
  const ids = (aliases: string[], kind: "CLIENT" | "ASSOC") =>
    [...new Set(aliases.map((a) => resolveAlias(map, a.trim())).filter((e) => e?.kind === kind).map((e) => e!.id))];
  const un = (t: string) => unaliasText(t.trim(), map);
  const associateIds = ids(output.associates_involved, "ASSOC");
  const faultIds = output.fault_party === "ASSOCIATE" || output.fault_party === "SHARED" ? ids(output.fault_associates, "ASSOC") : [];
  return {
    summary: un(output.summary),
    clientId: output.client ? (ids([output.client], "CLIENT")[0] ?? null) : null,
    // Anyone at fault is, by definition, involved.
    associateIds: [...new Set([...associateIds, ...faultIds])],
    faultAssociateIds: faultIds,
    category: output.category,
    severity: output.severity,
    faultParty: output.fault_party,
    faultRationale: un(output.fault_rationale),
    rootCause: un(output.root_cause),
    preventable: output.preventable,
    actions: output.recommended_actions
      .map((a) => ({ text: un(a.text), owner: a.owner === "me" ? ("ME" as const) : ("ASSOCIATE" as const) }))
      .filter((a) => a.text)
      .slice(0, 3),
    cautions: output.cautions.map(un).filter(Boolean),
  };
}

export function requestEscalationAnalysis(client: Anthropic, model: string, message: string): Promise<StructuredResult<EscalationOutput>> {
  return callStructured(client, { model, system: ESCALATION_SYSTEM, user: message, schema: escalationSchema, effort: "medium" });
}

/* ------------------------------------------- Trends ------------------------------------------- */

export const ESCALATION_TREND_PROMPT_VERSION = "escalation-trend-v1";

export const ESCALATION_TREND_SYSTEM = `You help a manager of payroll implementation associates find patterns in client escalations over a period. You receive counts calculated exactly in code and a list of the escalations the manager has reviewed and confirmed. Clients and associates appear as aliases (CLIENT_xx, ASSOC_xx).

Return:
- overview: 2 to 4 sentences on what the period shows.
- patterns: recurring patterns, each with a short explanation grounded in the data (for example a category that clusters early in implementations, or a client that recurs).
- process_fixes: 2 to 4 concrete changes to process, training or checklists that would prevent the most common or most severe escalations.
- watch_list: clients or associates (by alias) worth watching, with the reason. Be fair to associates: base this on confirmed fault, not on involvement alone.

If there are too few escalations to see patterns, say so instead of guessing. Use the counts as given. Write in plain, professional English.`;

export const escalationTrendSchema = z.object({
  overview: z.string(),
  patterns: z.array(z.object({ pattern: z.string(), detail: z.string() })),
  process_fixes: z.array(z.string()),
  watch_list: z.array(z.object({ who: z.string(), reason: z.string() })),
});

export type EscalationTrend = z.infer<typeof escalationTrendSchema>;

export type CodedEscalation = {
  occurredOn: string;
  client: string | null;
  associates: { alias: string; atFault: boolean }[];
  category: EscalationCategory;
  severity: Severity;
  faultParty: FaultParty;
  preventable: Preventable | null;
  rootCause: string;
  implementationType: string | null;
  stage: string | null;
};

export type Breakdown = { key: string; label: string; count: number }[];

export function escalationTrendMessage(input: {
  periodStart: string;
  periodEnd: string;
  total: number;
  byCategory: Breakdown;
  byFault: Breakdown;
  bySeverity: Breakdown;
  escalations: CodedEscalation[];
}): string {
  const counts = (title: string, b: Breakdown) => `${title}: ${b.map((x) => `${x.label} ${x.count}`).join(", ") || "none"}`;
  const list = input.escalations
    .map(
      (e) =>
        `- ${e.occurredOn} | ${CATEGORY_LABELS[e.category]} | ${e.severity} | fault: ${FAULT_LABELS[e.faultParty]} | client: ${e.client ?? "unknown"}${
          e.stage ? ` (${e.stage.toLowerCase()}${e.implementationType ? `, ${e.implementationType}` : ""})` : ""
        } | associates: ${e.associates.map((a) => `${a.alias}${a.atFault ? " (at fault)" : ""}`).join(", ") || "none"} | preventable: ${
          e.preventable ?? "unknown"
        } | root cause: ${e.rootCause || "not recorded"}`,
    )
    .join("\n");
  return [
    `## Period ${input.periodStart} to ${input.periodEnd}: ${input.total} confirmed escalation${input.total === 1 ? "" : "s"}`,
    [counts("By category", input.byCategory), counts("By fault", input.byFault), counts("By severity", input.bySeverity)].join("\n"),
    "## Escalations",
    list || "None.",
  ].join("\n\n");
}

export function requestEscalationTrend(client: Anthropic, model: string, message: string): Promise<StructuredResult<EscalationTrend>> {
  return callStructured(client, { model, system: ESCALATION_TREND_SYSTEM, user: message, schema: escalationTrendSchema, effort: "high" });
}
