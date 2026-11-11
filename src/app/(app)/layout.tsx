import { cookies } from "next/headers";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar, SIDEBAR_COOKIE } from "@/components/layout/sidebar";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireAdmin();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar initialCollapsed={collapsed} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}
