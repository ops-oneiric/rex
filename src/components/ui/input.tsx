import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl bg-white/75 px-3.5 text-sm text-ink ring-1 ring-rex-900/12 placeholder:text-ink-muted/60 transition-shadow focus:bg-white focus:outline-none focus:ring-2 focus:ring-rex-500 disabled:opacity-60 aria-invalid:ring-red-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...props} />;
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-rex-950", className)} {...props} />;
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs text-ink-muted", className)} {...props} />;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
  },
);

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-red-700">
      {message}
    </p>
  );
}

/** Checkbox with a label and optional hint, styled as a selectable tile. */
export function CheckboxTile({
  name,
  label,
  hint,
  defaultChecked,
  invalid,
  icon,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  invalid?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl bg-white/60 p-3.5 ring-1 ring-rex-900/10 transition-colors hover:bg-white/85 has-checked:bg-rex-50 has-checked:ring-2 has-checked:ring-rex-500 has-focus-visible:ring-2 has-focus-visible:ring-rex-500",
        invalid && "ring-red-500",
      )}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-rex-800"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-rex-950 [&_svg]:size-4 [&_svg]:text-rex-600">
          {icon}
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}
