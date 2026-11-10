import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored in the database.
 * Format: "v1:<iv b64>:<auth tag b64>:<ciphertext b64>".
 * The key comes from REX_ENCRYPTION_KEY (32 bytes, base64) and never touches the database.
 */

const VERSION = "v1";

export class EncryptionKeyError extends Error {}

export function loadEncryptionKey(raw = process.env.REX_ENCRYPTION_KEY): Buffer {
  if (!raw || !raw.trim()) {
    throw new EncryptionKeyError(
      "REX_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new EncryptionKeyError(
      "REX_ENCRYPTION_KEY must be 32 bytes encoded as base64 (openssl rand -base64 32).",
    );
  }
  return key;
}

export function hasEncryptionKey(): boolean {
  try {
    loadEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string, key: Buffer = loadEncryptionKey()): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string, key: Buffer = loadEncryptionKey()): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Unrecognized secret format.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
