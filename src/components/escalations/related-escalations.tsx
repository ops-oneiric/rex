import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { escalationsForAssociate, escalationsForClient, toListItems } from "@/lib/escalations/data";
import { EscalationList } from "./escalation-list";

/** Confirmed escalations for one client or associate. */
export function RelatedEscalations({ clientId, associateId }: { clientId?: number; associateId?: number }) {
  const rows = clientId ? escalationsForClient(clientId) : escalationsForAssociate(associateId!);
  const items = toListItems(rows);
  const atFault = associateId ? rows.filter((r) => r.people.some((p) => p.associateId === associateId && p.atFault)).length : 0;
  return (
    <Card className="p-0">
      <div className="p-6 pb-3">
        <CardHeader
          icon={<AlertTriangle />}
          title="Escalations"
          description={
            associateId
              ? `${rows.length} confirmed escalation${rows.length === 1 ? "" : "s"} involving them${rows.length ? `, ${atFault} with fault confirmed as theirs` : ""}.`
              : `${rows.length} confirmed escalation${rows.length === 1 ? "" : "s"}.`
          }
          action={
            <Link href="/escalations" className="inline-flex items-center gap-1 text-sm font-medium text-rex-700 hover:text-rex-900">
              <Plus className="size-4" aria-hidden="true" />
              Log one
            </Link>
          }
        />
      </div>
      {items.length > 0 && <EscalationList items={items} compact />}
    </Card>
  );
}
