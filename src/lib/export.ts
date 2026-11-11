import "server-only";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { clientLabel, IMPLEMENTATION_TYPE_LABELS, PREVIOUS_VENDOR_LABELS, STAGE_LABELS, SUPPORT_MODEL_LABELS } from "@/lib/clients/constants";
import { CATEGORY_LABELS, FAULT_LABELS, PREVENTABLE_LABELS, SEVERITY_LABELS } from "@/lib/escalations/constants";
import { type Cell, toCsv } from "@/lib/csv";

const { associates, associatePto, clients, assignments, escalations, escalationAssociates, actionItems, cadenceEntries } = schema;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function names() {
  const people = new Map(db.select({ id: associates.id, name: associates.name }).from(associates).all().map((a) => [a.id, a.name]));
  const companies = new Map(db.select().from(clients).all().map((c) => [c.id, clientLabel(c)]));
  return { people, companies };
}

type Dataset = { label: string; description: string; build: () => { headers: string[]; rows: Cell[][] } };

/** Spreadsheet exports offered in Settings. Each is your own data, decoded and readable. */
export const DATASETS = {
  clients: {
    label: "Clients",
    description: "Every client and prospect with your fields and stage.",
    build: () => ({
      headers: ["Company code", "Name", "Stage", "Implementation type", "Support model", "Employees", "First input", "Benefits start", "Time zone", "Controls", "Payroll complexity", "Previous vendor", "Assigned on", "Notes"],
      rows: db
        .select()
        .from(clients)
        .orderBy(asc(clients.companyCode))
        .all()
        .map((c) => [
          c.companyCode,
          c.displayName,
          STAGE_LABELS[c.lifecycleStage],
          c.implementationType && IMPLEMENTATION_TYPE_LABELS[c.implementationType],
          c.supportModel && SUPPORT_MODEL_LABELS[c.supportModel],
          c.employeeCount,
          c.firstInputDate,
          c.benefitsStartDate,
          c.timeZone,
          c.controlCount,
          c.payrollComplexity,
          c.previousVendor && PREVIOUS_VENDOR_LABELS[c.previousVendor],
          c.assignedOn,
          c.notes,
        ]),
    }),
  },
  associates: {
    label: "Associates",
    description: "Roster with seats, target load and capability notes.",
    build: () => ({
      headers: ["Name", "Title", "Email", "Time zone", "Can PM", "Can payroll", "Target load", "Directly managed", "Active", "Capability notes"],
      rows: db
        .select()
        .from(associates)
        .orderBy(asc(associates.name))
        .all()
        .map((a) => [a.name, a.title, a.email, a.timeZone, a.canPm, a.canPayroll, a.targetLoad, a.isDirectlyManaged, a.isActive, a.capabilityNotes]),
    }),
  },
  assignments: {
    label: "Assignments",
    description: "Current and past seats, with how each was chosen.",
    build: () => {
      const { people, companies } = names();
      return {
        headers: ["Client", "Associate", "Seat", "Status", "Start", "End", "End reason", "Source", "Override note"],
        rows: db
          .select()
          .from(assignments)
          .orderBy(asc(assignments.startDate))
          .all()
          .map((a) => [companies.get(a.clientId), people.get(a.associateId), a.seat, a.status, a.startDate, a.endDate, a.endReason, a.source, a.overrideNote]),
      };
    },
  },
  pto: {
    label: "PTO",
    description: "Every PTO entry.",
    build: () => {
      const { people } = names();
      return {
        headers: ["Associate", "First day", "Last day", "Partial day", "Note"],
        rows: db
          .select()
          .from(associatePto)
          .orderBy(asc(associatePto.startDate))
          .all()
          .map((p) => [people.get(p.associateId), p.startDate, p.endDate, p.isPartialDay, p.note]),
      };
    },
  },
  escalations: {
    label: "Escalations",
    description: "Details as you wrote them, with your confirmed review.",
    build: () => {
      const { people, companies } = names();
      const links = db.select().from(escalationAssociates).all();
      return {
        headers: ["Date", "Status", "Client", "Summary", "Category", "Severity", "Fault", "Associates at fault", "Associates involved", "Root cause", "Preventable", "Fault rationale", "Confirmed on", "Details"],
        rows: db
          .select()
          .from(escalations)
          .orderBy(asc(escalations.occurredOn))
          .all()
          .map((e) => {
            const mine = links.filter((l) => l.escalationId === e.id);
            const list = (rows: typeof mine) => rows.map((l) => people.get(l.associateId)).filter(Boolean).join("; ");
            return [
              e.occurredOn,
              e.status === "OPEN" ? "Open" : "Resolved",
              e.clientId ? companies.get(e.clientId) : null,
              e.summary,
              e.category && CATEGORY_LABELS[e.category],
              e.severity && SEVERITY_LABELS[e.severity],
              e.faultParty && FAULT_LABELS[e.faultParty],
              list(mine.filter((l) => l.atFault)),
              list(mine),
              e.rootCause,
              e.preventable && PREVENTABLE_LABELS[e.preventable],
              e.faultRationale,
              day(e.confirmedAt),
              e.details,
            ];
          }),
      };
    },
  },
  cadence: {
    label: "1:1 notes",
    description: "Every 1:1 as written, with Claude's summary.",
    build: () => {
      const { people } = names();
      return {
        headers: ["Associate", "Date", "Notes", "Summary"],
        rows: db
          .select()
          .from(cadenceEntries)
          .orderBy(asc(cadenceEntries.occurredOn))
          .all()
          .map((c) => [people.get(c.associateId), c.occurredOn, c.notes, (c.insight as { summary?: string } | null)?.summary ?? null]),
      };
    },
  },
  "action-items": {
    label: "Action items",
    description: "From 1:1s, escalations and your own.",
    build: () => {
      const { people } = names();
      return {
        headers: ["Associate", "Text", "Owner", "Status", "Source", "Due", "Created"],
        rows: db
          .select()
          .from(actionItems)
          .orderBy(asc(actionItems.createdAt))
          .all()
          .map((i) => [i.associateId ? people.get(i.associateId) : null, i.text, i.owner === "ME" ? "You" : "Associate", i.status, i.sourceType, i.dueHint, day(i.createdAt)]),
      };
    },
  },
} satisfies Record<string, Dataset>;

export type DatasetId = keyof typeof DATASETS;

export function isDataset(id: string): id is DatasetId {
  return Object.hasOwn(DATASETS, id);
}

export function exportCsv(id: DatasetId): string {
  const { headers, rows } = DATASETS[id].build();
  return toCsv(headers, rows);
}
