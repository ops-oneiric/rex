import fs from "node:fs";
import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { validateSession } from "@/lib/auth/session";
import { backupPath } from "@/lib/backups/service";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

/** Downloads one encrypted backup. Signed-in admin only; the proxy's cookie check is not enough. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/backups/[name]">) {
  if (!(await validateSession())) return new Response("Not found", { status: 404 });
  const { name } = await ctx.params;
  const file = backupPath(name);
  if (!file) return new Response("Not found", { status: 404 });
  audit("backup.downloaded", { name }, await clientIp());
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
