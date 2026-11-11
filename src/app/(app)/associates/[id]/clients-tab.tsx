import Link from "next/link";
import { Building2 } from "lucide-react";
import { LoadBar } from "@/components/assign/load-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { allLoads, associateAssignments } from "@/lib/assignments/data";
import { seatShare } from "@/lib/assignments/rules";
import { seatLabel } from "@/lib/assignments/seats";
import { clientLabel } from "@/lib/clients/constants";
import { clientContext, withFacts } from "@/lib/clients/data";
import { formatDate } from "@/lib/dates";
import { getRuleSettings } from "@/lib/settings";
import { relativeBusinessDays } from "../../clients/badges";

export function ClientsTab({ associateId, targetLoad }: { associateId: number; targetLoad: number }) {
  const rows = associateAssignments(associateId);
  const ctx = clientContext();
  const rules = getRuleSettings();
  const facts = new Map(withFacts(rows.map((r) => r.c), ctx).map((c) => [c.id, c]));
  const load = allLoads().get(associateId);
  const active = rows.filter((r) => r.a.status === "ACTIVE" && r.c.lifecycleStage === "IMPLEMENTATION");
  const holds = rows.filter((r) => r.a.status === "ACTIVE" && r.c.lifecycleStage === "PROSPECT");
  const past = rows.filter((r) => r.a.status === "ENDED");

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Building2 />} title="No clients yet" description="Assign this associate from a client's Team card or the Assign page." />
      </Card>
    );
  }

  const list = (items: typeof rows, showContribution: boolean) => (
    <ul className="divide-y divide-rex-900/6 rounded-xl bg-white/40 ring-1 ring-rex-900/8">
      {items.map(({ a, c }) => {
        const f = facts.get(c.id)!;
        const contribution = f.weight.total * seatShare(c.supportModel, a.seat, rules);
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm">
            <div className="min-w-40 flex-1">
              <Link href={`/clients/${c.id}`} className="font-medium text-rex-950 hover:underline">{clientLabel(c)}</Link>
              <p className="text-xs text-ink-muted">
                {seatLabel(a.seat, c.supportModel)} · since {formatDate(a.startDate)}
                {a.endDate && ` · ended ${formatDate(a.endDate)}`}
              </p>
            </div>
            <span className="tabular w-48 text-xs text-ink-muted">
              {c.firstInputDate ? (
                <>
                  First input {formatDate(c.firstInputDate)}
                  {a.status === "ACTIVE" && f.businessDaysToFirstInput !== null && <> ({relativeBusinessDays(f.businessDaysToFirstInput)})</>}
                </>
              ) : "No first input date"}
            </span>
            {f.fastStart?.isFastStart && a.status === "ACTIVE" && <Badge tone="warning">Fast start</Badge>}
            {showContribution && (
              <span className="tabular w-28 text-right text-xs text-ink" title="Client weight times this seat's share">
                +{contribution.toFixed(2)} load
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-6">
      {load && (
        <Card>
          <CardHeader
            icon={<Building2 />}
            title="Load"
            description={`${load.accounts} implementation account${load.accounts === 1 ? "" : "s"}${load.holds ? ` and ${load.holds} hold${load.holds === 1 ? "" : "s"}` : ""}. Actual load ${load.actual.toFixed(2)}; with holds ${load.projected.toFixed(2)}.`}
          />
          <LoadBar before={load.actual} after={load.projected} target={targetLoad} band={load.band} />
        </Card>
      )}
      {active.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-rex-950">Implementations ({active.length})</h2>
          {list(active, true)}
        </section>
      )}
      {holds.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-rex-950">Holds on prospects ({holds.length})</h2>
          {list(holds, true)}
        </section>
      )}
      {past.length > 0 && (
        <details className="glass p-4">
          <summary className="cursor-pointer text-sm font-semibold text-rex-950 select-none">Past clients ({past.length})</summary>
          <div className="mt-3">{list(past, false)}</div>
        </details>
      )}
    </div>
  );
}
