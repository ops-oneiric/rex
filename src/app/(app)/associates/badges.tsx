import { CalendarCheck, CalendarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function SeatBadges({ canPm, canPayroll }: { canPm: boolean; canPayroll: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {canPm && <Badge tone="primary">PM</Badge>}
      {canPayroll && <Badge tone="primary">Payroll</Badge>}
      {canPm && canPayroll && <Badge tone="neutral">Hybrid-eligible</Badge>}
    </span>
  );
}

const levelStyle = [
  "",
  "bg-white/60 text-ink-muted ring-rex-900/10",
  "bg-rex-100 text-rex-800 ring-rex-300/60",
  "bg-rex-800 text-white ring-rex-800",
];
const levelName = ["", "Learning", "Proficient", "Expert"];

export function CapabilityChip({ name, proficiency }: { name: string; proficiency: number }) {
  return (
    <span
      title={`${name}: ${levelName[proficiency]}`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        levelStyle[proficiency],
      )}
    >
      {name}
      <span className="sr-only"> ({levelName[proficiency]})</span>
    </span>
  );
}

export function PtoStatus({
  pto,
  today,
}: {
  pto: { startDate: string; endDate: string; isPartialDay: boolean } | null;
  today: string;
}) {
  if (!pto) return <span className="text-ink-muted/70">None scheduled</span>;
  if (pto.startDate <= today && today <= pto.endDate) {
    return (
      <Badge tone="warning">
        <CalendarOff aria-hidden="true" />
        {pto.isPartialDay ? "Partial day today" : `Out until ${formatDate(pto.endDate)}`}
      </Badge>
    );
  }
  return (
    <span className="tabular whitespace-nowrap text-ink">
      {formatDateRange(pto.startDate, pto.endDate)}
      {pto.isPartialDay && <span className="text-ink-muted"> (partial)</span>}
    </span>
  );
}

export function ManagedBadge() {
  return (
    <Badge tone="neutral" title="You manage this associate directly (Cadence)">
      <CalendarCheck aria-hidden="true" />
      Managed
    </Badge>
  );
}
