#!/usr/bin/env node
// Decrypts a Rex backup (.rexbak), checks it, and either writes it to a file or puts it in
// place of the live database. Needs the same REX_ENCRYPTION_KEY the backup was made with.
//
//   Inspect a backup (writes ./restored.db and prints what is inside):
//     node scripts/restore-backup.mjs data/backups/rex-20261111-020000.rexbak --out restored.db
//
//   Replace the live database (stop Rex first):
//     docker compose stop rex
//     docker compose run --rm rex node scripts/restore-backup.mjs /app/data/backups/<file> --replace
//     docker compose start rex
//
// The current database is kept beside it as rex.db.before-restore-<time>.
// The file layout mirrors src/lib/backups/format.ts.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const MAGIC = Buffer.from("REXBAK01", "ascii");
const INFO = Buffer.from("rex-backup-v1", "ascii");

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function loadKey() {
  const raw = process.env.REX_ENCRYPTION_KEY?.trim();
  if (!raw) fail("REX_ENCRYPTION_KEY is not set. Use the key the backup was made with.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) fail("REX_ENCRYPTION_KEY must be 32 bytes encoded as base64.");
  return key;
}

export function openBackup(sealed, master) {
  if (sealed.length < MAGIC.length + 44 || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("This is not a Rex backup file.");
  }
  let at = MAGIC.length;
  const salt = sealed.subarray(at, (at += 16));
  const iv = sealed.subarray(at, (at += 12));
  const tag = sealed.subarray(at, (at += 16));
  const key = Buffer.from(crypto.hkdfSync("sha256", master, salt, INFO, 32));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(sealed.subarray(at)), decipher.final()]);
  } catch {
    throw new Error("The backup could not be decrypted: wrong REX_ENCRYPTION_KEY, or the file is damaged.");
  }
}

function check(file) {
  // Read-write, so SQLite removes its -wal and -shm files when this connection closes.
  const db = new Database(file, { fileMustExist: true });
  try {
    const integrity = db.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error(`Integrity check failed: ${integrity}`);
    const count = (table) => {
      try {
        return db.prepare(`select count(*) as n from ${table}`).get().n;
      } catch {
        return "-";
      }
    };
    return {
      clients: count("clients"),
      associates: count("associates"),
      assignments: count("assignments"),
      "1:1 entries": count("cadence_entries"),
      escalations: count("escalations"),
      admin: count("admin_user"),
    };
  } finally {
    db.close();
  }
}

function main() {
  const args = process.argv.slice(2);
  let input = null;
  let out = "restored.db";
  let replace = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else if (args[i] === "--replace") replace = true;
    else input ??= args[i];
  }
  if (!input || !out) fail("Usage: node scripts/restore-backup.mjs <backup.rexbak> [--out restored.db | --replace]");
  if (!fs.existsSync(input)) fail(`No such file: ${input}`);

  let plain;
  try {
    plain = openBackup(fs.readFileSync(input), loadKey());
  } catch (err) {
    fail(err.message);
  }

  const live = path.resolve(process.env.DATABASE_PATH ?? "./data/rex.db");
  const target = replace ? `${live}.restoring` : path.resolve(out);
  if (!replace && fs.existsSync(target)) fail(`${target} already exists. Choose another --out file.`);
  fs.writeFileSync(target, plain, { mode: 0o600 });

  let summary;
  try {
    summary = check(target);
  } catch (err) {
    fs.rmSync(target, { force: true });
    fail(err.message);
  }
  console.log(`\nBackup ${path.basename(input)} is readable and intact:`);
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(12)} ${v}`);

  if (!replace) {
    console.log(`\nWrote ${target}. The live database was not touched.\n`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  if (fs.existsSync(live)) {
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(live + suffix)) fs.renameSync(live + suffix, `${live}.before-restore-${stamp}${suffix}`);
    }
  }
  fs.renameSync(target, live);
  console.log(`\nRestored into ${live}.`);
  console.log(`The previous database is at ${live}.before-restore-${stamp}. Start Rex again to use the restored data.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
