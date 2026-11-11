import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { validateSession } from "@/lib/auth/session";
import { exportCsv, isDataset } from "@/lib/export";
import { today } from "@/lib/settings";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

/** One dataset as CSV. Signed-in admin only. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/export/[dataset]">) {
  if (!(await validateSession())) return new Response("Not found", { status: 404 });
  const { dataset } = await ctx.params;
  if (!isDataset(dataset)) return new Response("Not found", { status: 404 });
  audit("export.downloaded", { dataset }, await clientIp());
  return new Response(exportCsv(dataset), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rex-${dataset}-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
