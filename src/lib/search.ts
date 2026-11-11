import "server-only";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { clientLabel, STAGE_LABELS } from "@/lib/clients/constants";

const { clients, associates } = schema;

export type SearchItem = { kind: "client" | "associate"; id: number; label: string; detail: string; href: string; keywords: string };

/** Everything the command palette can jump to besides pages. */
export function searchIndex(): SearchItem[] {
  const clientRows = db.select().from(clients).orderBy(asc(clients.companyCode)).all();
  const people = db.select().from(associates).orderBy(asc(associates.name)).all();
  return [
    ...clientRows.map((c) => ({
      kind: "client" as const,
      id: c.id,
      label: clientLabel(c),
      detail: STAGE_LABELS[c.lifecycleStage],
      href: `/clients/${c.id}`,
      keywords: [c.companyCode, c.displayName].filter(Boolean).join(" "),
    })),
    ...people.map((a) => ({
      kind: "associate" as const,
      id: a.id,
      label: a.name,
      detail: [a.title, a.isActive ? null : "Inactive"].filter(Boolean).join(" · ") || "Associate",
      href: `/associates/${a.id}`,
      keywords: [a.name, a.title, a.email].filter(Boolean).join(" "),
    })),
  ];
}
