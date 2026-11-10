import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const ADMIN_ID = 1;

export function getAdmin() {
  return db.select().from(schema.adminUser).where(eq(schema.adminUser.id, ADMIN_ID)).get();
}
