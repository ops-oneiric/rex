import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";
import { backupName, backupsToPrune, backupTime, BackupFormatError, openBackup, sealBackup } from "@/lib/backups/format";
import { toCsv } from "@/lib/csv";
// The restore script is plain Node so it runs on the server without a build; it must read our files.
import { openBackup as scriptOpenBackup } from "../../scripts/restore-backup.mjs";

const key = crypto.randomBytes(32);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rex-backup-test-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("backup format", () => {
  const plain = Buffer.from("SQLite format 3\u0000 pretend database");

  it("round-trips, and each file uses fresh randomness", () => {
    const a = sealBackup(plain, key);
    const b = sealBackup(plain, key);
    expect(a.equals(b)).toBe(false);
    expect(openBackup(a, key).equals(plain)).toBe(true);
    expect(a.includes(Buffer.from("pretend database"))).toBe(false);
  });

  it("refuses the wrong key, a damaged file, and files that aren't backups", () => {
    const sealed = sealBackup(plain, key);
    expect(() => openBackup(sealed, crypto.randomBytes(32))).toThrow(BackupFormatError);
    const damaged = Buffer.from(sealed);
    damaged[damaged.length - 1]! ^= 1;
    expect(() => openBackup(damaged, key)).toThrow(/wrong REX_ENCRYPTION_KEY, or the file is damaged/);
    expect(() => openBackup(Buffer.from("hello"), key)).toThrow(/not a Rex backup/);
  });

  it("is readable by the restore script", () => {
    expect(scriptOpenBackup(sealBackup(plain, key), key).equals(plain)).toBe(true);
  });

  it("names files by UTC time and reads the time back", () => {
    const at = new Date("2026-11-11T02:05:09Z");
    expect(backupName(at)).toBe("rex-20261111-020509.rexbak");
    expect(backupTime("rex-20261111-020509.rexbak")?.toISOString()).toBe("2026-11-11T02:05:09.000Z");
    expect(backupTime("../etc/passwd")).toBeNull();
    expect(backupTime("rex-20261111-020509.rexbak.tmp")).toBeNull();
  });

  it("prunes old files but always keeps the newest seven", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    const daily = Array.from({ length: 40 }, (_, i) => backupName(new Date(now.getTime() - i * 86_400_000)));
    const pruned = backupsToPrune(daily, now, 30);
    expect(pruned).toHaveLength(9);
    expect(pruned).not.toContain(daily[0]);
    expect(pruned).toContain(daily[39]);
    // After a long outage, only old files exist: keep the newest seven anyway.
    const stale = daily.slice(32);
    expect(backupsToPrune(stale, now, 30)).toEqual(stale.slice(7));
    expect(backupsToPrune(["notes.txt"], now, 30)).toEqual([]);
  });
});

describe("restore drill", () => {
  it("decrypts a real SQLite backup into a working database, and refuses the wrong key", async () => {
    // Like production: a WAL-mode database copied with SQLite's online backup while open.
    const source = path.join(tmp, "source.db");
    const db = new Database(source);
    db.pragma("journal_mode = WAL");
    db.exec("create table clients (id integer primary key, company_code text); insert into clients (company_code) values ('ACM'), ('BLV');");
    const snapshot = path.join(tmp, "snapshot.db");
    await db.backup(snapshot);
    db.close();
    const backup = path.join(tmp, backupName(new Date()));
    fs.writeFileSync(backup, sealBackup(fs.readFileSync(snapshot), key));

    const out = path.join(tmp, "restored.db");
    const run = (k: string) =>
      spawnSync(process.execPath, ["scripts/restore-backup.mjs", backup, "--out", out], {
        env: { ...process.env, REX_ENCRYPTION_KEY: k },
        encoding: "utf8",
      });

    const wrong = run(crypto.randomBytes(32).toString("base64"));
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toMatch(/could not be decrypted/);
    expect(fs.existsSync(out)).toBe(false);

    const ok = run(key.toString("base64"));
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/is readable and intact/);
    expect(ok.stdout).toMatch(/clients\s+2/);
    // The integrity check leaves no -wal or -shm files behind.
    expect(fs.existsSync(`${out}-wal`) || fs.existsSync(`${out}-shm`)).toBe(false);
    const restored = new Database(out, { readonly: true });
    expect(restored.prepare("select company_code from clients order by id").all()).toEqual([{ company_code: "ACM" }, { company_code: "BLV" }]);
    restored.close();
  });
});

describe("CSV export", () => {
  it("quotes, escapes and neutralises formulas", () => {
    const csv = toCsv(
      ["Name", "Note", "Count", "Flag"],
      [
        ["Acme, Inc.", 'said "hi"', 3, true],
        ["=HYPERLINK(\"x\")", "+1 call", -2, null],
        ["@SUM(A1)", "line\nbreak", 1.5, false],
      ],
    );
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("Name,Note,Count,Flag");
    expect(lines[1]).toBe('"Acme, Inc.","said ""hi""",3,yes');
    expect(lines[2]).toBe(`"'=HYPERLINK(""x"")",'+1 call,-2,`);
    expect(csv).toContain(`'@SUM(A1),"line\nbreak",1.5,no`);
  });
});
