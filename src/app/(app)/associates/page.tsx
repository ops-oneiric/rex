import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listRoster } from "@/lib/associates/data";
import { requireAdmin } from "@/lib/auth/dal";
import { today } from "@/lib/settings";
import { Roster } from "./roster";

export const metadata = { title: "Associates" };

const addButton = (
  <Link
    href="/associates/new"
    className="inline-flex h-10 items-center gap-2 rounded-xl bg-rex-900 px-4 text-sm font-medium text-white shadow-md shadow-rex-900/20 hover:bg-rex-800"
  >
    <Plus className="size-4" aria-hidden="true" />
    Add associate
  </Link>
);

export default async function AssociatesPage() {
  await requireAdmin();
  const todayIso = today();
  const rows = listRoster(todayIso);

  return (
    <>
      <PageHeader
        title="Associates"
        description="Your roster, the seats each person can fill, their capabilities and PTO."
        actions={rows.length > 0 ? addButton : undefined}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="No associates yet"
            description="Add the people who take clients. You can mark the ones you manage directly for Cadence."
            action={addButton}
          />
        </Card>
      ) : (
        <Roster rows={rows} today={todayIso} />
      )}
    </>
  );
}
