import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const prefix = "enc:v1:";
const aad = Buffer.from("longyuchat:model-api-key:v1");
const legacyAad = Buffer.from("ai-chat-lab:model-api-key:v1");

function encrypt(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(value.trim(), "utf8"), cipher.final()]);
  return prefix + [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value, key) {
  const parts = value.slice(prefix.length).split(".");
  if (parts.length !== 3) throw new Error("Invalid stored secret format.");
  for (const associatedData of [aad, legacyAad]) {
    try {
      const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(associatedData);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch { /* Try the documented legacy AAD before reporting failure. */ }
  }
  throw new Error("An existing encrypted secret cannot be decrypted with the configured key. No changes made.");
}

async function main() {
  const rawKey = process.env.MODEL_SECRET_ENCRYPTION_KEY?.trim() ?? "";
  const key = Buffer.from(rawKey, /^[a-f\d]{64}$/i.test(rawKey) ? "hex" : "base64");
  if (key.length !== 32) throw new Error("A valid 32-byte MODEL_SECRET_ENCRYPTION_KEY is required.");
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) throw new Error("A SQLite file DATABASE_URL is required.");
  const databasePath = path.resolve(url.slice(5));
  const db = new Database(databasePath, { fileMustExist: true });
  try {
    const tables = ["model_configs", "provider_connections"];
    let encryptedCount = 0;
    const changes = [];
    for (const table of tables) {
      for (const row of db.prepare("SELECT id, api_key FROM " + table).all()) {
        if (!row.api_key?.trim()) continue;
        if (row.api_key.startsWith(prefix)) {
          decrypt(row.api_key, key);
          encryptedCount += 1;
        } else {
          changes.push({ table, id: row.id, original: row.api_key, encrypted: encrypt(row.api_key, key) });
        }
      }
    }
    if (!changes.length) {
      console.log(JSON.stringify({ changed: 0, verifiedEncrypted: encryptedCount }));
      return;
    }
    const backupDirectory = path.resolve(process.env.SQLITE_BACKUP_DIR || "var/backups/sqlite");
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupPath = path.join(backupDirectory, "before-secret-encryption-" + Date.now() + ".db");
    await db.backup(backupPath);
    db.transaction(() => {
      for (const change of changes) {
        if (decrypt(change.encrypted, key) !== change.original.trim()) throw new Error("Secret verification failed.");
        const result = db.prepare("UPDATE " + change.table + " SET api_key = ? WHERE id = ? AND api_key = ?")
          .run(change.encrypted, change.id, change.original);
        if (result.changes !== 1) throw new Error("Configuration changed during encryption. Retry after stopping writers.");
      }
    })();
    console.log(JSON.stringify({ changed: changes.length, verifiedEncrypted: encryptedCount, backupPath }));
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Secret encryption failed.");
  process.exitCode = 1;
});
