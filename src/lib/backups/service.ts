import "server-only";
import fs from "node:fs";
import path from "node:path";
import { audit } from "@/lib/audit";
import { loadEncryptionKey } from "@/lib/crypto/secrets";
import { databasePath, db } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { getBackupStatus, getHomeTimeZone, setBackupStatus } from "@/lib/settings";
import { BACKUP_NAME, backupName, backupsToPrune, backupTime, sealBackup } from "./format";

/** Where backups live. Point REX_BACKUP_DIR at a different disk or a synced folder if you can. */
export function backupDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.REX_BACKUP_DIR ?? path.join(path.dirname(databasePath()), "backups"));
}

export function retentionDays(): number {
  const n = Number(process.env.REX_BACKUP_RETENTION_DAYS ?? 30);
  return Number.isInteger(n) && n >= 1 ? n : 30;
}

/** Local hour (your time zone) after which the nightly backup runs. */
export function backupHour(): number {
  const n = Number(process.env.REX_BACKUP_HOUR ?? 2);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 2;
}

export function backupsEnabled(): boolean {
  return process.env.REX_BACKUPS !== "off";
}

export type BackupFile = { name: string; createdAt: Date; bytes: number };

export function listBackups(): BackupFile[] {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => BACKUP_NAME.test(name))
    .map((name) => ({ name, createdAt: backupTime(name)!, bytes: fs.statSync(path.join(dir, name)).size }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Absolute path of a backup, or null if the name is not one of ours (no path tricks). */
export function backupPath(name: string): string | null {
  if (!BACKUP_NAME.test(name)) return null;
  const file = path.join(backupDir(), name);
  return fs.existsSync(file) ? file : null;
}

let running: Promise<BackupFile> | null = null;

/**
 * Takes a consistent snapshot with SQLite's online backup (safe while Rex is running),
 * encrypts it, writes it atomically, then prunes old files.
 */
export function createBackup(reason: "scheduled" | "manual"): Promise<BackupFile> {
  if (running) return running;
  running = (async () => {
    const dir = backupDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const now = new Date();
    const name = backupName(now);
    const snapshot = path.join(dir, `.${name}.sqlite.tmp`);
    const partial = path.join(dir, `.${name}.tmp`);
    try {
      const key = loadEncryptionKey();
      await db.$client.backup(snapshot);
      fs.writeFileSync(partial, sealBackup(fs.readFileSync(snapshot), key), { mode: 0o600 });
      fs.renameSync(partial, path.join(dir, name));
      for (const old of backupsToPrune(listBackups().map((b) => b.name), now, retentionDays())) {
        fs.rmSync(path.join(dir, old), { force: true });
      }
      const file = listBackups().find((b) => b.name === name)!;
      setBackupStatus({ ...getBackupStatus(), lastSuccessAt: now.toISOString() });
      audit("backup.created", { name, bytes: file.bytes, reason });
      return file;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBackupStatus({ ...getBackupStatus(), lastError: message, lastErrorAt: now.toISOString() });
      audit("backup.failed", { reason, message });
      throw err;
    } finally {
      fs.rmSync(snapshot, { force: true });
      fs.rmSync(partial, { force: true });
      running = null;
    }
  })();
  return running;
}

/** True once the nightly hour has passed today and there is no backup from today yet. */
export function nightlyBackupDue(now = new Date()): boolean {
  const tz = getHomeTimeZone();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < backupHour()) return false;
  const today = todayIn(tz, now);
  const newest = listBackups()[0];
  return !newest || todayIn(tz, newest.createdAt) !== today;
}

/** Backup health for the dashboard and Settings. */
export function backupHealth(now = new Date()) {
  const status = getBackupStatus();
  const newest = listBackups()[0] ?? null;
  const ageHours = newest ? (now.getTime() - newest.createdAt.getTime()) / 3_600_000 : null;
  const failedSinceSuccess = !!status.lastErrorAt && (!status.lastSuccessAt || status.lastErrorAt > status.lastSuccessAt);
  return {
    enabled: backupsEnabled(),
    newest,
    // A brand-new install has no backup until its first night; only a backup that stopped coming is stale.
    stale: backupsEnabled() && ageHours !== null && ageHours > 48,
    failing: failedSinceSuccess,
    lastError: failedSinceSuccess ? status.lastError : null,
  };
}

const CHECK_EVERY_MS = 15 * 60 * 1000;
const globalForBackups = globalThis as unknown as { __rexBackupTimer?: NodeJS.Timeout };

/** Checks every 15 minutes whether tonight's backup is due. Started once per server process. */
export function startBackupScheduler() {
  if (!backupsEnabled() || globalForBackups.__rexBackupTimer) return;
  const tick = () => {
    try {
      if (nightlyBackupDue()) createBackup("scheduled").catch(() => {});
    } catch {
      // Status is recorded by createBackup; never let the timer throw.
    }
  };
  setTimeout(tick, 60_000).unref();
  globalForBackups.__rexBackupTimer = setInterval(tick, CHECK_EVERY_MS);
  globalForBackups.__rexBackupTimer.unref();
}
