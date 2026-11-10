export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export function GET() {
  db.run(sql`select 1`);
  return Response.json({ status: "ok" });
}
