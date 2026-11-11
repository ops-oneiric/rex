import { CircleCheck, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FAULT_LABELS, type FaultParty, SEVERITY_LABELS, type Severity } from "@/lib/escalations/constants";

const severityTone = { LOW: "neutral", MEDIUM: "primary", HIGH: "warning", CRITICAL: "danger" } as const;

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return null;
  return <Badge tone={severityTone[severity]}>{SEVERITY_LABELS[severity]}</Badge>;
}

export function FaultBadge({ fault }: { fault: FaultParty | null }) {
  if (!fault) return null;
  return <Badge tone="neutral">Fault: {FAULT_LABELS[fault]}</Badge>;
}

export function StatusBadge({ status }: { status: "OPEN" | "RESOLVED" }) {
  return status === "OPEN" ? (
    <Badge tone="warning">Open</Badge>
  ) : (
    <Badge tone="success">
      <CircleCheck aria-hidden="true" />
      Resolved
    </Badge>
  );
}

export function ReviewBadge({ confirmed }: { confirmed: boolean }) {
  if (confirmed) return null;
  return (
    <Badge tone="primary">
      <Eye aria-hidden="true" />
      Needs review
    </Badge>
  );
}
