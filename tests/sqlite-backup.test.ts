import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { expect, it } from "vitest";

const run = promisify(execFile);

it("backs up committed WAL data into a restorable file and prunes only its own expired backups", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "longyuchat-backup-test-"));
  const databasePath = path.join(temporaryDirectory, "source.db");
  const backupDirectory = path.join(temporaryDirectory, "backups");
  fs.mkdirSync(backupDirectory);
  const database = new Database(databasePath);
  try {
    database.pragma("journal_mode = WAL");
    database.pragma("wal_autocheckpoint = 0");
    database.exec("CREATE TABLE messages (id INTEGER PRIMARY KEY, content TEXT NOT NULL)");
    const insert = database.prepare("INSERT INTO messages (content) VALUES (?)");
    database.transaction(() => { for (let i = 0; i < 50; i += 1) insert.run(`synthetic-${i}`); })();
    expect(fs.statSync(`${databasePath}-wal`).size).toBeGreaterThan(0);

    const oldOwned = path.join(backupDirectory, "sqlite-backup-20000101T000000000Z-11111111-1111-4111-8111-111111111111-source.db");
    const preserved = ["operator-notes.txt", "2000-01-01-0000-source.db", "sqlite-backup-20000101T000000000Z-11111111-1111-4111-8111-111111111111-other.db"];
    for (const filename of [path.basename(oldOwned), ...preserved]) {
      const file = path.join(backupDirectory, filename);
      fs.writeFileSync(file, "unrelated or expired synthetic data");
      fs.utimesSync(file, new Date("2000-01-01"), new Date("2000-01-01"));
    }

    const { stdout } = await run(process.execPath, [path.resolve("scripts/sqlite-backup.mjs")], {
      cwd: temporaryDirectory,
      env: { ...process.env, DATABASE_URL: `file:${databasePath}`, SQLITE_BACKUP_DIR: backupDirectory, SQLITE_BACKUP_RETENTION_DAYS: "7" },
      windowsHide: true,
      timeout: 20_000,
    });
    const result = JSON.parse(stdout.trim()) as { destinationDatabasePath: string; method: string; integrity: string };
    expect(result).toMatchObject({ method: "sqlite-online-backup", integrity: "ok" });
    expect(fs.existsSync(oldOwned)).toBe(false);
    for (const filename of preserved) expect(fs.existsSync(path.join(backupDirectory, filename))).toBe(true);
    expect(fs.existsSync(`${result.destinationDatabasePath}-wal`)).toBe(false);
    expect(fs.readdirSync(backupDirectory).some((name) => name.endsWith(".partial"))).toBe(false);

    const restoredPath = path.join(temporaryDirectory, "restored.db");
    fs.copyFileSync(result.destinationDatabasePath, restoredPath);
    const restored = new Database(restoredPath, { readonly: true, fileMustExist: true });
    try {
      expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(restored.prepare("SELECT count(*) AS count FROM messages").get()).toEqual({ count: 50 });
      expect(restored.prepare("SELECT content FROM messages WHERE id = 50").get()).toEqual({ content: "synthetic-49" });
    } finally {
      restored.close();
    }
  } finally {
    database.close();
    // This test-created absolute directory is the sole recursive cleanup target.
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
