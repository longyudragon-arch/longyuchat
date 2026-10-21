import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

function parsePositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must use a SQLite file: URL for sqlite:backup.");
  }

  const rawPath = databaseUrl.slice("file:".length);

  if (!rawPath) {
    throw new Error("DATABASE_URL does not contain a SQLite file path.");
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(process.cwd(), rawPath);
}

function getBackupDirectory() {
  return process.env.SQLITE_BACKUP_DIR?.trim() || path.join(process.cwd(), "var", "backups", "sqlite");
}

function buildTimestamp() {
  return new Date().toISOString().replaceAll(/[-:.]/g, "");
}

function pruneExpiredBackups(directory, retentionDays, sourceFileName) {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const escapedName = sourceFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ownedBackupPattern = new RegExp(`^sqlite-backup-\\d{8}T\\d{9}Z-[a-f0-9-]{36}-${escapedName}$`);

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !ownedBackupPattern.test(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    const stat = fs.statSync(fullPath);

    if (stat.mtimeMs < cutoffMs) {
      fs.unlinkSync(fullPath);
    }
  }
}

async function main() {
  const sourceDatabasePath = resolveSqlitePath(process.env.DATABASE_URL);
  const backupDirectory = getBackupDirectory();
  const retentionDays = parsePositiveInteger(process.env.SQLITE_BACKUP_RETENTION_DAYS, 7);

  if (!fs.existsSync(sourceDatabasePath)) {
    throw new Error(`SQLite database file was not found: ${sourceDatabasePath}`);
  }

  fs.mkdirSync(backupDirectory, { recursive: true });

  const sourceFileName = path.basename(sourceDatabasePath);
  const timestamp = buildTimestamp();
  const destinationDatabasePath = path.join(backupDirectory, `sqlite-backup-${timestamp}-${randomUUID()}-${sourceFileName}`);
  const temporaryPath = `${destinationDatabasePath}.partial`;
  const database = new Database(sourceDatabasePath, { readonly: true, fileMustExist: true });
  try {
    fs.closeSync(fs.openSync(temporaryPath, "wx", 0o600));
    // SQLite's online backup API includes committed WAL pages in one consistent
    // database image. Never copy the live database and sidecars separately.
    await database.backup(temporaryPath);
    const snapshot = new Database(temporaryPath, { readonly: true, fileMustExist: true });
    try {
      if (snapshot.pragma("quick_check", { simple: true }) !== "ok") {
        throw new Error("SQLite backup integrity verification failed.");
      }
    } finally {
      snapshot.close();
    }
    fs.renameSync(temporaryPath, destinationDatabasePath);
  } finally {
    database.close();
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }

  pruneExpiredBackups(backupDirectory, retentionDays, sourceFileName);

  process.stdout.write(
    JSON.stringify({
      ok: true,
      sourceDatabasePath,
      backupDirectory,
      destinationDatabasePath,
      method: "sqlite-online-backup",
      integrity: "ok",
      retentionDays,
    }) + "\n",
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "SQLite backup failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
