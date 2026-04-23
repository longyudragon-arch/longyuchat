import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const secretPrefix = "enc:v1:";
const currentAad = Buffer.from("longyuchat:model-api-key:v1", "utf8");
const legacyAads = [Buffer.from("ai-chat-lab:model-api-key:v1", "utf8")];
const encryptionAlgorithm = "aes-256-gcm";

interface DecryptSecretOptions {
  nodeEnv?: string;
}

function normalizeSecret(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Secret value is required.");
  }

  return normalized;
}

function parseEncryptionKey(rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY) {
  if (!rawKey?.trim()) {
    return null;
  }

  const normalized = rawKey.trim();

  if (/^[0-9a-f]{64}$/i.test(normalized)) {
    return Buffer.from(normalized, "hex");
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    const decoded = Buffer.from(normalized, "base64");

    if (decoded.length === 32) {
      return decoded;
    }
  }

  throw new Error("MODEL_SECRET_ENCRYPTION_KEY must be a 32-byte base64 string or a 64-character hex string.");
}

function requireEncryptionKey(rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY) {
  const key = parseEncryptionKey(rawKey);

  if (!key) {
    throw new Error("MODEL_SECRET_ENCRYPTION_KEY is required to encrypt or decrypt model secrets.");
  }

  return key;
}

export function isModelSecretEncrypted(value: string) {
  return value.startsWith(secretPrefix);
}

export function isModelSecretEncryptionConfigured(rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY) {
  return parseEncryptionKey(rawKey) !== null;
}

export function encryptModelSecret(secret: string, rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY) {
  const key = requireEncryptionKey(rawKey);
  const normalizedSecret = normalizeSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(encryptionAlgorithm, key, iv);
  cipher.setAAD(currentAad);

  const encrypted = Buffer.concat([cipher.update(normalizedSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${secretPrefix}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptModelSecret(secret: string, rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY) {
  const key = requireEncryptionKey(rawKey);

  if (!isModelSecretEncrypted(secret)) {
    throw new Error("The provided model secret is not encrypted.");
  }

  const payload = secret.slice(secretPrefix.length);
  const [ivPart, tagPart, cipherPart] = payload.split(".");

  if (!ivPart || !tagPart || !cipherPart) {
    throw new Error("The stored model secret payload is invalid.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(cipherPart, "base64url");
  const aadCandidates = [currentAad, ...legacyAads];
  let lastError: Error | null = null;

  for (const aad of aadCandidates) {
    try {
      const decipher = createDecipheriv(encryptionAlgorithm, key, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
      return normalizeSecret(decrypted);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Could not decrypt the stored model secret.");
    }
  }

  throw lastError ?? new Error("Could not decrypt the stored model secret.");
}

export function decryptModelSecretOrPlaintext(
  secret: string,
  rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY,
  options: DecryptSecretOptions = {},
) {
  if (!isModelSecretEncrypted(secret)) {
    if ((options.nodeEnv ?? process.env.NODE_ENV) === "production") {
      throw new Error("Stored model secret must be encrypted before running in production.");
    }

    return normalizeSecret(secret);
  }

  return decryptModelSecret(secret, rawKey);
}
