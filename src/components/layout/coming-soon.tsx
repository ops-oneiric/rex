import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Placeholder for pages that later phases will build. */
export function ComingSoon({
  phase,
  icon,
  title,
  points,
  className,
}: {
  phase: number;
  icon: React.ReactNode;
  title: string;
  points: string[];
  className?: string;
}) {
  return (
    <Card className={cn("max-w-2xl", className)}>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rex-100 text-rex-800 [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-rex-950">{title}</h2>
            <Badge tone="primary">Phase {phase}</Badge>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
            {points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-rex-400" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
