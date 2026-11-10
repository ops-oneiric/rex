import { cn } from "@/lib/utils";

export type RadioTileOption = { value: string; label: string; hint?: string };

/** A radio group shown as selectable tiles. Leave `unsetLabel` to offer a "not set" choice. */
export function RadioTiles({
  name,
  options,
  defaultValue,
  invalid,
  unsetLabel,
  columns = 3,
  labelledBy,
  describedBy,
}: {
  name: string;
  options: RadioTileOption[];
  defaultValue: string;
  invalid?: boolean;
  unsetLabel?: string;
  columns?: 2 | 3 | 4;
  labelledBy?: string;
  describedBy?: string;
}) {
  const all = unsetLabel ? [...options, { value: "", label: unsetLabel }] : options;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(
        "grid grid-cols-1 gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {all.map((o) => (
        <label
          key={o.value || "unset"}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-xl bg-white/60 p-3 ring-1 ring-rex-900/10 transition-colors hover:bg-white/85",
            "has-checked:bg-rex-50 has-checked:ring-2 has-checked:ring-rex-500 has-focus-visible:ring-2 has-focus-visible:ring-rex-500",
            invalid && "ring-red-500",
            !o.value && "text-ink-muted",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="mt-0.5 size-4 shrink-0 accent-rex-800"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-rex-950">{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-xs text-ink-muted">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
