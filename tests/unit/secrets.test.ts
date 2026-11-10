import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, EncryptionKeyError, loadEncryptionKey } from "@/lib/crypto/secrets";

const key = crypto.randomBytes(32);

describe("secret encryption", () => {
  it("round-trips a value", () => {
    const sealed = encryptSecret("sk-ant-example-key-1234", key);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("sk-ant");
    expect(decryptSecret(sealed, key)).toBe("sk-ant-example-key-1234");
  });

  it("uses a fresh IV every time", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("rejects tampered ciphertext", () => {
    const [v, iv, tag, data] = encryptSecret("value", key).split(":");
    const flipped = Buffer.from(data!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"), key)).toThrow();
  });

  it("rejects the wrong key", () => {
    const sealed = encryptSecret("value", key);
    expect(() => decryptSecret(sealed, crypto.randomBytes(32))).toThrow();
  });

  it("validates the configured key", () => {
    expect(() => loadEncryptionKey("")).toThrow(EncryptionKeyError);
    expect(() => loadEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow(EncryptionKeyError);
    expect(loadEncryptionKey(key.toString("base64")).equals(key)).toBe(true);
  });
});
