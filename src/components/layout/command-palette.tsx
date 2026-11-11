"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CornerDownLeft,
  Plus,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { searchIndexAction } from "@/app/(app)/search-actions";
import type { SearchItem } from "@/lib/search";
import { rankMatches } from "@/lib/search-match";
import { cn } from "@/lib/utils";
import { footerNav, mainNav } from "./nav";

const OPEN_EVENT = "rex:open-search";

/** Opens the palette from anywhere, e.g. the sidebar's Search button. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const noop = () => () => {};
/** "⌘K" on Apple devices, "Ctrl K" elsewhere. Server render assumes Ctrl. */
export function useShortcutLabel() {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );
}

type Entry = { id: string; group: string; label: string; detail?: string; keywords?: string; href: string; icon: LucideIcon };

const PAGES: Entry[] = [...mainNav, ...footerNav].map((n) => ({
  id: `page:${n.href}`,
  group: "Pages",
  label: n.label,
  href: n.href,
  icon: n.icon,
}));

const ACTIONS: Entry[] = [
  { id: "action:client", group: "Actions", label: "New client or prospect", keywords: "add create company", href: "/clients/new", icon: Plus },
  { id: "action:associate", group: "Actions", label: "New associate", keywords: "add create person", href: "/associates/new", icon: Plus },
  { id: "action:escalation", group: "Actions", label: "Log an escalation", keywords: "new add", href: "/escalations", icon: AlertTriangle },
  { id: "action:cadence", group: "Actions", label: "Log a 1:1", keywords: "cadence one on one meeting new", href: "/cadence", icon: CalendarCheck },
];

function toEntry(item: SearchItem): Entry {
  return {
    id: `${item.kind}:${item.id}`,
    group: item.kind === "client" ? "Clients" : "Associates",
    label: item.label,
    detail: item.detail,
    keywords: item.keywords,
    href: item.href,
    icon: item.kind === "client" ? Building2 : UserRound,
  };
}

/**
 * Ctrl+K (Cmd+K on a Mac) jumps to any client by company code or name, any associate,
 * any page, or a common action. Built on the native <dialog> for focus handling, with the
 * combobox/listbox pattern so screen readers announce the highlighted result.
 */
export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [loading, startLoading] = useTransition();
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    inputRef.current?.focus();
    startLoading(async () => {
      try {
        setIndex(await searchIndexAction());
      } catch {
        setIndex((prev) => prev ?? []);
      }
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, open);
    };
  }, [open]);

  const results = useMemo(() => {
    const records = (index ?? []).map(toEntry);
    if (!query.trim()) return [...PAGES, ...ACTIONS];
    return [
      ...rankMatches(records.filter((r) => r.group === "Clients"), query, 6),
      ...rankMatches(records.filter((r) => r.group === "Associates"), query, 6),
      ...rankMatches(PAGES, query, 4),
      ...rankMatches(ACTIONS, query, 4),
    ];
  }, [index, query]);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    dialogRef.current?.close();
    router.push(entry.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      const next = (current + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[current]);
    }
  };

  const groups = results.reduce<{ name: string; items: { entry: Entry; i: number }[] }[]>((acc, entry, i) => {
    const last = acc.at(-1);
    if (last?.name === entry.group) last.items.push({ entry, i });
    else acc.push({ name: entry.group, items: [{ entry, i }] });
    return acc;
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search Rex"
      className="glass m-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] bg-white/90 p-0 text-ink backdrop:bg-rex-950/40 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      onClose={() => {
        setQuery("");
        setActive(0);
      }}
    >
      <div className="flex items-center gap-3 border-b border-rex-900/8 px-4">
        <Search className="size-[18px] shrink-0 text-rex-500" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? optionId(current) : undefined}
          aria-label="Jump to a client, associate or page"
          placeholder="Company code, name or page..."
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted/70"
        />
        <kbd className="hidden rounded-md bg-rex-900/6 px-1.5 py-0.5 font-sans text-[11px] text-ink-muted sm:inline">Esc</kbd>
      </div>
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
        <ul id={listId} role="listbox" aria-label="Results">
          {groups.map((g) => (
            <li key={g.name} role="presentation">
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase" aria-hidden="true">
                {g.name}
              </div>
              <ul role="group" aria-label={g.name}>
                {g.items.map(({ entry, i }) => {
                  const Icon = entry.icon;
                  const selected = i === current;
                  return (
                    <li
                      key={entry.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={() => go(entry)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm",
                        selected ? "bg-rex-900 text-white" : "text-ink",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", selected ? "text-rex-200" : "text-rex-500")} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
                      {entry.detail && (
                        <span className={cn("shrink-0 text-xs", selected ? "text-rex-200" : "text-ink-muted")}>{entry.detail}</span>
                      )}
                      {selected && <CornerDownLeft className="size-3.5 shrink-0 text-rex-200" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-muted" role="status">
            {loading && !index ? "Loading..." : `Nothing matches "${query.trim()}".`}
          </p>
        )}
      </div>
    </dialog>
  );
}
