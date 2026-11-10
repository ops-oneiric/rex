import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "error";

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-rex-100/70 text-rex-900 ring-rex-300/50", Icon: Info },
  success: { box: "bg-emerald-50/80 text-emerald-900 ring-emerald-600/20", Icon: CircleCheck },
  error: { box: "bg-red-50/80 text-red-900 ring-red-600/20", Icon: CircleAlert },
};

export function Alert({
  tone = "info",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1 ring-inset", box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
