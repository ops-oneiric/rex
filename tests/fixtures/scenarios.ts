/**
 * Recommendation scenarios (plan Section 6.4). Each describes a client, a roster and what a
 * good answer must or must not do. Used by unit tests (payload and rules checks, no API)
 * and by `npm run eval` (live calls to Claude, run on demand).
 */
import { DEFAULT_RULES, evaluateCandidate, rankCandidates, type RuleAssociate, type RuleClient, clientNeeds } from "@/lib/assignments/rules";
import { SEATS_BY_MODEL, type Seat } from "@/lib/assignments/seats";
import { buildAliasMap } from "@/lib/privacy/alias";
import type { RecommendationInput } from "@/lib/ai/recommend/core";

export const TODAY = "2026-11-11";
const holidays = new Set(["2026-11-26", "2026-12-25", "2027-01-01"]);

type Person = Partial<RuleAssociate> & { id: number; name: string; notes?: string };

export type Scenario = {
  name: string;
  client: Partial<RuleClient> & { notes?: string };
  people: Person[];
  /** Associates already on the team. */
  fixed?: { seat: Seat; associateId: number }[];
  expect: {
    /** The best team must put one of these associates in this seat. */
    topSeat?: { seat: Seat; oneOf: number[] }[];
    /** No team may use these associates. */
    never?: number[];
  };
};

const base = (o: Partial<RuleAssociate> & { id: number; name: string }): RuleAssociate => ({
  isActive: true,
  canPm: true,
  canPayroll: true,
  timeZone: "America/Chicago",
  targetLoad: 8,
  capabilities: { "new logo": 2 },
  pto: [],
  held: [],
  history: [],
  ...o,
});

const held = (clientId: number, firstInputDate: string, weight = 1.2) => ({
  clientId,
  label: `Other ${clientId}`,
  seat: "PAYROLL_1" as const,
  stage: "IMPLEMENTATION" as const,
  supportModel: "TRADITIONAL" as const,
  firstInputDate,
  weight,
});

const heavy = (n: number) => Array.from({ length: n }, (_, i) => held(900 + i, "2027-03-01", 1.4));

export const SCENARIOS: Scenario[] = [
  {
    name: "PTO before go-live knocks out the strongest payroll candidate",
    client: { supportModel: "TRADITIONAL", firstInputDate: "2026-12-08" },
    people: [
      { id: 1, name: "Expert With PTO", canPm: false, capabilities: { "new logo": 3 }, pto: [{ startDate: "2026-12-07", endDate: "2026-12-07", isPartialDay: false }] },
      { id: 2, name: "Solid Payroll", canPm: false },
      { id: 3, name: "PM One", canPayroll: false },
    ],
    expect: { topSeat: [{ seat: "PAYROLL_1", oneOf: [2] }, { seat: "PM", oneOf: [3] }], never: [1] },
  },
  {
    name: "Avoids stacking first inputs on one associate",
    client: { supportModel: "HYBRID", firstInputDate: "2026-12-08" },
    people: [
      { id: 1, name: "Busy Week", held: [held(50, "2026-12-09"), held(51, "2026-12-10")] },
      { id: 2, name: "Clear Calendar", held: [held(52, "2027-02-10")] },
    ],
    expect: { topSeat: [{ seat: "HYBRID", oneOf: [2] }] },
  },
  {
    name: "Keeps an associate out of over-capacity",
    client: { supportModel: "HYBRID", firstInputDate: "2027-01-20", employeeCount: 600, payrollComplexity: 4 },
    people: [
      { id: 1, name: "At Ten", held: heavy(7) },
      { id: 2, name: "At Four", held: heavy(3) },
    ],
    expect: { topSeat: [{ seat: "HYBRID", oneOf: [2] }] },
  },
  {
    name: "Union client goes to the union specialist",
    client: { supportModel: "TRADITIONAL", firstInputDate: "2027-01-20", payrollComplexity: 5, notes: "Two union locals with certified payroll." },
    people: [
      { id: 1, name: "Union Expert", canPm: false, capabilities: { "union / certified payroll": 3, "complex payroll": 3 }, notes: "Our go-to for union and prevailing wage clients." },
      { id: 2, name: "Generalist", canPm: false, capabilities: { "new logo": 2 } },
      { id: 3, name: "PM One", canPayroll: false },
    ],
    expect: { topSeat: [{ seat: "PAYROLL_1", oneOf: [1] }] },
  },
  {
    name: "PM-model team fills both payroll seats with distinct people",
    client: { supportModel: "PM", firstInputDate: "2027-02-01", employeeCount: 700, controlCount: 4 },
    people: [
      { id: 1, name: "PM Lead", canPayroll: false, capabilities: { "multi-control": 3, "large employer (500+)": 3 } },
      { id: 2, name: "Payroll A", canPm: false, capabilities: { "multi-control": 2 } },
      { id: 3, name: "Payroll B", canPm: false, capabilities: { "large employer (500+)": 2 } },
      { id: 4, name: "Payroll C Out", canPm: false, pto: [{ startDate: "2027-01-29", endDate: "2027-02-02", isPartialDay: false }] },
    ],
    expect: { topSeat: [{ seat: "PM", oneOf: [1] }], never: [4] },
  },
  {
    name: "Fast start avoids payroll PTO before first input",
    client: { supportModel: "TRADITIONAL", firstInputDate: "2026-12-01", isFastStart: true, fastStartFrom: TODAY },
    people: [
      { id: 1, name: "Vacation Next Week", canPm: false, pto: [{ startDate: "2026-11-16", endDate: "2026-11-18", isPartialDay: false }] },
      { id: 2, name: "Available Now", canPm: false },
      { id: 3, name: "PM One", canPayroll: false },
    ],
    expect: { topSeat: [{ seat: "PAYROLL_1", oneOf: [2] }] },
  },
  {
    name: "Keeps the fixed PM and fills only payroll",
    client: { supportModel: "TRADITIONAL", firstInputDate: "2027-01-12" },
    fixed: [{ seat: "PM", associateId: 3 }],
    people: [
      { id: 1, name: "Payroll Fit", canPm: false, capabilities: { "new logo": 3 } },
      { id: 2, name: "Payroll Ok", canPm: false, capabilities: { "new logo": 1 } },
      { id: 3, name: "Fixed PM", canPayroll: false },
    ],
    expect: { topSeat: [{ seat: "PAYROLL_1", oneOf: [1, 2] }], never: [3] },
  },
  {
    name: "Prefers the near time zone when everything else is equal",
    client: { supportModel: "HYBRID", firstInputDate: "2027-01-20", timeZone: "America/New_York" },
    people: [
      { id: 1, name: "Pacific", timeZone: "America/Los_Angeles" },
      { id: 2, name: "Eastern", timeZone: "America/New_York" },
    ],
    expect: { topSeat: [{ seat: "HYBRID", oneOf: [2] }] },
  },
  {
    name: "PM seat with PTO is a concern, not a knock-out",
    client: { supportModel: "TRADITIONAL", firstInputDate: "2026-12-08" },
    people: [
      { id: 1, name: "PM With PTO", canPayroll: false, pto: [{ startDate: "2026-12-09", endDate: "2026-12-09", isPartialDay: false }] },
      { id: 2, name: "PM Clear", canPayroll: false },
      { id: 3, name: "Payroll One", canPm: false },
    ],
    expect: { topSeat: [{ seat: "PM", oneOf: [2] }] },
  },
  {
    name: "In-house conversion goes to the conversion specialist",
    client: { supportModel: "HYBRID", firstInputDate: "2027-01-20", previousVendor: "IN_HOUSE" },
    people: [
      { id: 1, name: "Conversion Pro", capabilities: { "in-house conversions": 3, "new logo": 2 }, notes: "Ran six in-house conversions this year without escalations." },
      { id: 2, name: "No Conversions", capabilities: { "new logo": 3 } },
    ],
    expect: { topSeat: [{ seat: "HYBRID", oneOf: [1] }] },
  },
];

/** Builds the same input the app builds, from a scenario instead of the database. */
export function scenarioInput(s: Scenario, random: () => number = () => 0.42): RecommendationInput {
  const client: RuleClient = {
    id: 1,
    lifecycleStage: "IMPLEMENTATION",
    supportModel: "TRADITIONAL",
    firstInputDate: null,
    benefitsStartDate: null,
    timeZone: "America/Chicago",
    employeeCount: 120,
    controlCount: 1,
    payrollComplexity: 3,
    implementationType: "NEW_LOGO",
    previousVendor: "NEW",
    weight: 1.1,
    isFastStart: false,
    fastStartFrom: TODAY,
    ...s.client,
  };
  const people = s.people.map((p) => base(p));
  const fixed = s.fixed ?? [];
  const seats = SEATS_BY_MODEL[client.supportModel!].filter((seat) => !fixed.some((f) => f.seat === seat));
  const otherClients = [...new Set(people.flatMap((p) => p.held.map((h) => h.clientId)))];
  const subjects = {
    clients: [
      { id: 1, companyCode: "TST", displayName: "Test Client", label: "TST · Test Client" },
      ...otherClients.map((id) => ({ id, companyCode: null, displayName: `Other ${id}`, label: `Other ${id}` })),
    ],
    associates: people.map((p) => ({ id: p.id, name: p.name })),
  };
  return {
    client: { ...client, notes: s.client.notes ?? "", needs: clientNeeds(client, holidays), businessDaysToFirstInput: null, label: "TST · Test Client" },
    openSeats: seats.map((seat) => ({
      seat,
      candidates: rankCandidates(
        people.map((a) => evaluateCandidate(client, seat, a, { today: TODAY, holidays, rules: DEFAULT_RULES, teamAssociateIds: fixed.map((f) => f.associateId) })),
      ),
    })),
    fixedMembers: fixed,
    associateProfiles: new Map(
      people.map((p) => [p.id, { capabilities: p.capabilities, notes: s.people.find((x) => x.id === p.id)?.notes ?? "", timeZone: p.timeZone, targetLoad: p.targetLoad }]),
    ),
    subjects,
    map: buildAliasMap(subjects, random),
  };
}
