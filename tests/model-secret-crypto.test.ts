import { createCipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  decryptModelSecret,
  decryptModelSecretOrPlaintext,
  encryptModelSecret,
  isModelSecretEncrypted,
} from "@/server/security/model-secret-crypto";

const base64Key = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");
const legacyAad = Buffer.from("ai-chat-lab:model-api-key:v1", "utf8");

function encryptWithLegacyAad(secret: string) {
  const key = Buffer.from(base64Key, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(legacyAad);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

describe("model secret crypto", () => {
  it("encrypts and decrypts model API keys with AES-GCM", () => {
    const encrypted = encryptModelSecret("secret-key", base64Key);

    expect(isModelSecretEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toContain("secret-key");
    expect(decryptModelSecret(encrypted, base64Key)).toBe("secret-key");
  });

  it("keeps legacy plaintext secrets readable", () => {
    expect(decryptModelSecretOrPlaintext("legacy-plain-key", undefined)).toBe("legacy-plain-key");
  });

  it("rejects legacy plaintext secrets in production", () => {
    expect(() =>
      decryptModelSecretOrPlaintext("legacy-plain-key", base64Key, {
        nodeEnv: "production",
      }),
    ).toThrow("Stored model secret must be encrypted before running in production.");
  });

  it("rejects encrypted secrets when the encryption key is missing", () => {
    const encrypted = encryptModelSecret("secret-key", base64Key);

    expect(() => decryptModelSecret(encrypted, undefined)).toThrow(
      "MODEL_SECRET_ENCRYPTION_KEY is required to encrypt or decrypt model secrets.",
    );
  });

  it("rejects invalid encryption key formats", () => {
    expect(() => encryptModelSecret("secret-key", "short-key")).toThrow(
      "MODEL_SECRET_ENCRYPTION_KEY must be a 32-byte base64 string or a 64-character hex string.",
    );
  });

  it("keeps legacy ai-chat-lab ciphertext readable after the rename", () => {
    const encrypted = encryptWithLegacyAad("legacy-secret-key");

    expect(decryptModelSecret(encrypted, base64Key)).toBe("legacy-secret-key");
  });
});
