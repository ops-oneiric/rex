import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

/** Applies any pending migrations from ./drizzle. Safe to run on every start. */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
}
