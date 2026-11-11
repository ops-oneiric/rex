import Link from "next/link";
import { CalendarRange, OctagonAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { TimelineEntry } from "@/lib/assignments/data";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** First inputs by week, with open seats and associates who have colliding first inputs. */
export function FirstInputTimeline({ weeks, days }: { weeks: { weekOf: string; entries: TimelineEntry[] }[]; days: number }) {
  return (
    <Card>
      <CardHeader
        icon={<CalendarRange />}
        title="First input timeline"
        description={`Implementation go-lives in the next ${days} days. Red names have another first input within the conflict window.`}
      />
      {weeks.length === 0 ? (
        <p className="text-sm text-ink-muted">No first inputs in the next {days} days.</p>
      ) : (
        <ol className="space-y-4">
          {weeks.map((w) => (
            <li key={w.weekOf}>
              <h3 className="mb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase">Week of {formatDate(w.weekOf)}</h3>
              <ul className="divide-y divide-rex-900/6 rounded-xl bg-white/40 ring-1 ring-rex-900/8">
                {w.entries.map((e) => (
                  <li key={e.clientId} className="px-3 py-2.5 text-sm">
                    <div className="flex items-baseline gap-3">
                      <span className="tabular w-24 shrink-0 text-ink-muted">
                        {weekday.format(new Date(`${e.firstInputDate}T00:00:00Z`))}
                      </span>
                      <Link href={`/clients/${e.clientId}`} className="min-w-0 flex-1 truncate font-medium text-rex-950 hover:underline">
                        {e.label}
                      </Link>
                    </div>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-27">
                      {e.team.map((m) => (
                        <span
                          key={m.associateId}
                          title={m.conflictWith.length ? `Also has first input for ${m.conflictWith.join(", ")}` : undefined}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset",
                            m.conflictWith.length ? "bg-red-50 text-red-800 ring-red-600/20" : "bg-rex-100 text-rex-800 ring-rex-300/60",
                          )}
                        >
                          {m.conflictWith.length > 0 && <OctagonAlert className="size-3" aria-hidden="true" />}
                          {m.name}
                          {m.conflictWith.length > 0 && <span className="sr-only"> (collides with {m.conflictWith.join(", ")})</span>}
                        </span>
                      ))}
                      {e.openSeats > 0 && (
                        <Link href={`/assign/${e.clientId}`}>
                          <Badge tone="warning">{e.openSeats} open seat{e.openSeats === 1 ? "" : "s"}</Badge>
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
