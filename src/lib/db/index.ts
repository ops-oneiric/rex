import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export function databasePath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/rex.db");
}

function open(): DB {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// Reuse one connection per server process (and across dev hot reloads).
const globalForDb = globalThis as unknown as { __rexDb?: DB };
export const db: DB = globalForDb.__rexDb ?? (globalForDb.__rexDb = open());

export { schema };
