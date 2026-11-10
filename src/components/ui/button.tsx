import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-rex-900 text-white shadow-md shadow-rex-900/20 hover:bg-rex-800 active:bg-rex-950 disabled:bg-rex-900/50",
  secondary:
    "bg-white/70 text-rex-900 ring-1 ring-rex-900/10 hover:bg-white active:bg-rex-50 disabled:text-rex-900/40",
  ghost: "text-rex-800 hover:bg-rex-900/5 active:bg-rex-900/10 disabled:text-rex-900/40",
  danger:
    "bg-white/70 text-red-700 ring-1 ring-red-700/20 hover:bg-red-50 active:bg-red-100 disabled:text-red-700/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
