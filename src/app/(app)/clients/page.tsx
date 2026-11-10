import Link from "next/link";
import { Building2, Columns3, Plus, Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/dal";
import { listClients, withFacts } from "@/lib/clients/data";
import { cn } from "@/lib/utils";
import { ClientBrowser } from "./client-browser";

export const metadata = { title: "Clients" };

const addButton = (
  <Link
    href="/clients/new"
    className="inline-flex h-10 items-center gap-2 rounded-xl bg-rex-900 px-4 text-sm font-medium text-white shadow-md shadow-rex-900/20 hover:bg-rex-800"
  >
    <Plus className="size-4" aria-hidden="true" />
    Add client
  </Link>
);

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  await requireAdmin();
  const view = (await searchParams).view === "board" ? "board" : "table";
  const rows = withFacts(listClients());

  const toggle = (
    <div className="glass inline-flex rounded-xl p-1" role="group" aria-label="View">
      {(
        [
          ["table", "Table", Table2, "/clients"],
          ["board", "Board", Columns3, "/clients?view=board"],
        ] as const
      ).map(([id, label, Icon, href]) => (
        <Link
          key={id}
          href={href}
          aria-current={view === id ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
            view === id ? "bg-rex-900 text-white" : "text-rex-900 hover:bg-white/70",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Clients"
        description="Prospects, implementations and clients that have moved to service."
        actions={
          rows.length > 0 ? (
            <>
              {toggle}
              {addButton}
            </>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 />}
            title="No clients yet"
            description="Add prospects as they come in, and the implementations already on your book."
            action={addButton}
          />
        </Card>
      ) : (
        <ClientBrowser rows={rows} view={view} />
      )}
    </>
  );
}
