import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** "light" for light backgrounds, "dark" for the sidebar. */
  tone?: "light" | "dark";
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { box: "size-8 rounded-lg", icon: "size-4", text: "text-lg" },
  md: { box: "size-9 rounded-xl", icon: "size-5", text: "text-xl" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6", text: "text-2xl" },
};

export function Logo({ tone = "light", showWordmark = true, size = "md", className }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center",
          s.box,
          tone === "light"
            ? "bg-rex-900 text-white shadow-lg shadow-rex-900/25"
            : "bg-gradient-to-br from-rex-500 to-rex-700 text-white ring-1 ring-white/20",
        )}
        aria-hidden="true"
      >
        <Crown className={s.icon} strokeWidth={2} />
      </span>
      {showWordmark && (
        <span
          className={cn(
            "font-semibold tracking-tight",
            s.text,
            tone === "light" ? "text-rex-900" : "text-white",
          )}
        >
          Rex
        </span>
      )}
    </span>
  );
}
