import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: string; href: string; count?: number; muted?: boolean };

/** Link-based tabs: the active tab lives in the URL, so it survives reloads and sharing. */
export function Tabs({ items, active, label }: { items: TabItem[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 mb-6 overflow-x-auto px-1">
      <ul className="glass inline-flex min-w-max gap-1 rounded-2xl p-1.5">
        {items.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-rex-900 text-white shadow-md shadow-rex-900/20"
                    : tab.muted
                      ? "text-ink-muted/70 hover:bg-white/70 hover:text-ink-muted"
                      : "text-rex-900 hover:bg-white/70",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-xs",
                      isActive ? "bg-white/20 text-white" : "bg-rex-900/8 text-ink-muted",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
