import { describe, expect, it } from "vitest";

import {
  decryptModelSecret,
  decryptModelSecretOrPlaintext,
  encryptModelSecret,
  isModelSecretEncrypted,
} from "@/server/security/model-secret-crypto";

const base64Key = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");

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
});
