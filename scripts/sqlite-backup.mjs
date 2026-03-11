import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

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
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "-").slice(0, 15);
}

function pruneExpiredBackups(directory, retentionDays) {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    const stat = fs.statSync(fullPath);

    if (stat.mtimeMs < cutoffMs) {
      fs.unlinkSync(fullPath);
    }
  }
}

function copyIfExists(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  fs.copyFileSync(sourcePath, destinationPath);
  return true;
}

function main() {
  const sourceDatabasePath = resolveSqlitePath(process.env.DATABASE_URL);
  const backupDirectory = getBackupDirectory();
  const retentionDays = parsePositiveInteger(process.env.SQLITE_BACKUP_RETENTION_DAYS, 7);

  if (!fs.existsSync(sourceDatabasePath)) {
    throw new Error(`SQLite database file was not found: ${sourceDatabasePath}`);
  }

  fs.mkdirSync(backupDirectory, { recursive: true });

  const sourceFileName = path.basename(sourceDatabasePath);
  const timestamp = buildTimestamp();
  const destinationDatabasePath = path.join(backupDirectory, `${timestamp}-${sourceFileName}`);
  const destinationWalPath = `${destinationDatabasePath}-wal`;
  const destinationShmPath = `${destinationDatabasePath}-shm`;

  fs.copyFileSync(sourceDatabasePath, destinationDatabasePath);
  const copiedWal = copyIfExists(`${sourceDatabasePath}-wal`, destinationWalPath);
  const copiedShm = copyIfExists(`${sourceDatabasePath}-shm`, destinationShmPath);

  pruneExpiredBackups(backupDirectory, retentionDays);

  process.stdout.write(
    JSON.stringify({
      ok: true,
      sourceDatabasePath,
      backupDirectory,
      destinationDatabasePath,
      copiedWal,
      copiedShm,
      retentionDays,
    }) + "\n",
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "SQLite backup failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
