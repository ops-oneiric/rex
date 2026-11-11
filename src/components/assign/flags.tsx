import { AlertTriangle, OctagonAlert } from "lucide-react";
import type { Flag } from "@/lib/assignments/rules";
import { cn } from "@/lib/utils";

export function FlagList({ flags, className }: { flags: Flag[]; className?: string }) {
  if (!flags.length) return null;
  return (
    <ul className={cn("space-y-1", className)}>
      {flags.map((f) => (
        <li
          key={f.text}
          className={cn("flex items-start gap-1.5 text-xs", f.level === "red" ? "text-red-800" : "text-amber-800")}
        >
          {f.level === "red" ? (
            <OctagonAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            <span className="sr-only">{f.level === "red" ? "Serious: " : "Caution: "}</span>
            {f.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
