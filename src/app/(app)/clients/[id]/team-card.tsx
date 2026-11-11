import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { LoadBar } from "@/components/assign/load-bar";
import { Card, CardHeader } from "@/components/ui/card";
import { allLoads, getTeam, pastAssignments } from "@/lib/assignments/data";
import { seatLabel } from "@/lib/assignments/seats";
import type { ClientWithFacts } from "@/lib/clients/data";
import { formatDate } from "@/lib/dates";
import { UnassignButton } from "./unassign-button";

const endReason = { UNASSIGNED: "Unassigned", REPLACED: "Replaced", SERVICE: "Moved to Service" } as const;

export function TeamCard({ client }: { client: ClientWithFacts }) {
  const isProspect = client.lifecycleStage === "PROSPECT";
  const isService = client.lifecycleStage === "SERVICE";
  const team = getTeam(client);
  const past = pastAssignments(client.id);
  const loads = allLoads();
  const filled = team.filter((t) => t.assignment).length;

  return (
    <Card>
      <CardHeader
        icon={<Users />}
        title={isProspect ? "Holds" : "Team"}
        description={
          isService
            ? "In Service: the team's assignments have ended."
            : !client.supportModel
              ? "Set a support model to define the team's seats."
              : isProspect
                ? "Optional holds on associates for this prospect. They count as projected load only."
                : `${filled} of ${team.length} seat${team.length === 1 ? "" : "s"} filled${client.assignedOn ? ` · assigned ${formatDate(client.assignedOn)}` : ""}`
        }
        action={
          client.supportModel && !isService ? (
            <Link
              href={`/assign/${client.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rex-900 px-3 text-sm font-medium text-white hover:bg-rex-800"
            >
              {filled === team.length ? "Review" : isProspect ? "Add holds" : "Assign"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />

      {client.supportModel && !isService && (
        <ul className="divide-y divide-rex-900/6 rounded-xl bg-white/40 ring-1 ring-rex-900/8">
          {team.map(({ seat, assignment }) => {
            const load = assignment ? loads.get(assignment.associateId) : undefined;
            return (
              <li key={seat} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <span className="w-24 shrink-0 text-xs font-medium tracking-wide text-ink-muted uppercase">
                  {seatLabel(seat, client.supportModel)}
                </span>
                {assignment ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <Link href={`/associates/${assignment.associateId}?tab=clients`} className="text-sm font-medium text-rex-950 hover:underline">
                        {assignment.associateName}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        Since {formatDate(assignment.startDate)}
                        {assignment.overrideNote && ` · PTO override: ${assignment.overrideNote}`}
                      </p>
                    </div>
                    {load && (
                      <LoadBar className="w-44" before={load.projected} target={load.targetLoad} band={load.band} />
                    )}
                    <UnassignButton assignmentId={assignment.id} name={assignment.associateName} />
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-ink-muted">Unfilled</span>
                    <Link href={`/assign/${client.id}?seat=${seat}`} className="text-sm font-medium text-rex-700 hover:text-rex-900">
                      Choose
                    </Link>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-rex-900 select-none">Past team members ({past.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {past.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <Link href={`/associates/${p.associateId}?tab=clients`} className="text-rex-950 hover:underline">{p.associateName}</Link>
                  <span className="text-ink-muted"> · {seatLabel(p.seat, client.supportModel)}</span>
                </span>
                <span className="tabular text-xs text-ink-muted">
                  {formatDate(p.startDate)} to {p.endDate ? formatDate(p.endDate) : "?"}
                  {p.endReason && ` · ${endReason[p.endReason]}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
