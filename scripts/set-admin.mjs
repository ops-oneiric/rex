#!/usr/bin/env node
// Creates the Rex admin account, or resets its password (which also clears any lockout
// and signs out every session). Run on the server:
//
//   docker compose exec rex node scripts/set-admin.mjs
//   npm run admin            (local development)
//
// Non-interactive use: set REX_ADMIN_USERNAME and REX_ADMIN_PASSWORD in the environment.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Writable } from "node:stream";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { hash } from "@node-rs/argon2";

// Mirrors src/lib/auth/policy.ts.
const MIN_LENGTH = 12;
const MAX_LENGTH = 256;

function validate(password, username) {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (password.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  if (password.toLowerCase().includes(username.toLowerCase())) return "The password must not contain the username.";
  if (new Set(password).size < 5) return "The password is too repetitive.";
  return null;
}

function ask(question, { hidden = false } = {}) {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
}

const dbFile = path.resolve(process.env.DATABASE_PATH ?? "./data/rex.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");
migrate(drizzle(sqlite), { migrationsFolder: path.join(process.cwd(), "drizzle") });

const existing = sqlite.prepare("select username from admin_user where id = 1").get();
const interactive = !process.env.REX_ADMIN_PASSWORD;

let username = process.env.REX_ADMIN_USERNAME?.trim() || "";
if (!username) {
  const fallback = existing?.username ?? "admin";
  username = interactive ? (await ask(`Username [${fallback}]: `)).trim() || fallback : fallback;
}
if (!/^[A-Za-z0-9._@-]{3,64}$/.test(username)) {
  console.error("Username must be 3-64 characters: letters, numbers, . _ @ -");
  process.exit(1);
}

let password = process.env.REX_ADMIN_PASSWORD ?? "";
if (interactive) {
  password = await ask("New password: ", { hidden: true });
  const confirm = await ask("Confirm password: ", { hidden: true });
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
}
const problem = validate(password, username);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
const now = Date.now();
sqlite
  .prepare(
    `insert into admin_user (id, username, password_hash, failed_attempts, locked_until, password_changed_at, created_at, updated_at)
     values (1, ?, ?, 0, null, ?, ?, ?)
     on conflict(id) do update set username = excluded.username, password_hash = excluded.password_hash,
       failed_attempts = 0, locked_until = null, password_changed_at = excluded.password_changed_at,
       updated_at = excluded.updated_at`,
  )
  .run(username, passwordHash, now, now, now);
sqlite.prepare("delete from sessions").run();
sqlite
  .prepare("insert into audit_log (action, detail, created_at) values (?, ?, ?)")
  .run("password.changed", JSON.stringify({ via: "set-admin script" }), now);

console.log(existing ? `Password reset for "${username}". All sessions were signed out.` : `Admin "${username}" created.`);
sqlite.close();
