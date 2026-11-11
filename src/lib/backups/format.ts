import crypto from "node:crypto";

/**
 * Encrypted backup files. A backup is a full SQLite snapshot sealed with AES-256-GCM, using
 * a key derived (HKDF-SHA256, random salt per file) from REX_ENCRYPTION_KEY, so a copied
 * backup is useless without the server's key.
 *
 * Layout: "REXBAK01" (8 bytes) | salt (16) | iv (12) | auth tag (16) | ciphertext.
 * scripts/restore-backup.mjs reads the same layout; keep the two in step.
 */

export const MAGIC = Buffer.from("REXBAK01", "ascii");
const INFO = Buffer.from("rex-backup-v1", "ascii");
const HEADER = MAGIC.length + 16 + 12 + 16;

export class BackupFormatError extends Error {}

function deriveKey(master: Buffer, salt: Buffer): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", master, salt, INFO, 32));
}

export function sealBackup(plain: Buffer, master: Buffer): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(master, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function openBackup(sealed: Buffer, master: Buffer): Buffer {
  if (sealed.length < HEADER || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new BackupFormatError("This is not a Rex backup file.");
  }
  let at = MAGIC.length;
  const salt = sealed.subarray(at, (at += 16));
  const iv = sealed.subarray(at, (at += 12));
  const tag = sealed.subarray(at, (at += 16));
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(master, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(sealed.subarray(at)), decipher.final()]);
  } catch {
    throw new BackupFormatError("The backup could not be decrypted: wrong REX_ENCRYPTION_KEY, or the file is damaged.");
  }
}

/** rex-20261111-020000.rexbak: UTC timestamp, so names sort by time. */
export const BACKUP_NAME = /^rex-(\d{8})-(\d{6})\.rexbak$/;

export function backupName(at: Date): string {
  const iso = at.toISOString(); // 2026-11-11T02:00:00.000Z
  return `rex-${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 19).replaceAll(":", "")}.rexbak`;
}

export function backupTime(name: string): Date | null {
  const m = BACKUP_NAME.exec(name);
  if (!m) return null;
  const [d, t] = [m[1]!, m[2]!];
  return new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`);
}

/**
 * Which backups to delete: older than `days`, but never the newest `keep`, so a long outage
 * of the scheduler can't empty the folder.
 */
export function backupsToPrune(names: string[], now: Date, days: number, keep = 7): string[] {
  const dated = names
    .map((name) => ({ name, at: backupTime(name) }))
    .filter((b): b is { name: string; at: Date } => b.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const cutoff = now.getTime() - days * 86_400_000;
  return dated.slice(keep).filter((b) => b.at.getTime() < cutoff).map((b) => b.name);
}
