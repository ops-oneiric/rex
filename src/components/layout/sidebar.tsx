"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { logout } from "@/app/login/actions";
import { cn } from "@/lib/utils";
import { footerNav, mainNav, type NavItem } from "./nav";

export const SIDEBAR_COOKIE = "rex_sidebar";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active ? "bg-white/15 text-white shadow-inner shadow-white/5" : "text-rex-200 hover:bg-white/8 hover:text-white",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        title={collapsed ? "Sign out" : undefined}
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-rex-200 transition-colors hover:bg-white/8 hover:text-white",
          collapsed && "justify-center px-0",
        )}
      >
        <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && "sr-only")}>Sign out</span>
      </button>
    </form>
  );
}

function NavSections({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-4">
        {footerNav.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        <SignOutButton collapsed={collapsed} />
      </div>
    </>
  );
}

export function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  // Links close the drawer themselves (onNavigate); Escape closes it too.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "glass-dark sticky top-4 m-4 mr-0 hidden h-[calc(100dvh-2rem)] shrink-0 flex-col rounded-2xl p-3 transition-[width] duration-200 md:flex",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <div className={cn("mb-6 flex items-center px-1.5 pt-1.5", collapsed ? "justify-center" : "justify-between")}>
          <Link href="/" aria-label="Rex home">
            <Logo tone="dark" size="sm" showWordmark={!collapsed} />
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="grid size-8 place-items-center rounded-lg text-rex-300 hover:bg-white/10 hover:text-white"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mb-3 grid h-9 place-items-center rounded-lg text-rex-300 hover:bg-white/10 hover:text-white"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          </button>
        )}
        <NavSections collapsed={collapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="glass-dark sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:hidden">
        <Link href="/" aria-label="Rex home">
          <Logo tone="dark" size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="grid size-9 place-items-center rounded-lg text-white hover:bg-white/10"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-rex-950/40 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="glass-dark absolute inset-y-0 left-0 flex w-72 flex-col rounded-r-2xl p-3">
            <div className="mb-6 flex items-center justify-between px-1.5 pt-1.5">
              <Logo tone="dark" size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-rex-300 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <NavSections collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
