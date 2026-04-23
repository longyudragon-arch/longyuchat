import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertNoPlaintextSecretsInSqliteDatabase,
  findPlaintextSecretRowsInSqlite,
} from "@/scripts/startup-readiness.mjs";

const tempDirectories = new Set<string>();

function createDatabaseFile() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "longyuchat-startup-"));
  tempDirectories.add(tempDirectory);
  const databasePath = path.join(tempDirectory, "app.db");
  const database = new Database(databasePath);

  database.exec(`
    CREATE TABLE model_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT
    );

    CREATE TABLE provider_connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT
    );
  `);

  return { database, databasePath };
}

describe("startup secret readiness", () => {
  afterEach(() => {
    for (const tempDirectory of tempDirectories) {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }

    tempDirectories.clear();
  });

  it("finds plaintext API keys in both model and provider tables", () => {
    const { database, databasePath } = createDatabaseFile();

    database.exec(`
      INSERT INTO model_configs (id, name, api_key) VALUES ('model-1', 'Gemini 主模型', 'plain-model-key');
      INSERT INTO provider_connections (id, name, api_key) VALUES ('connection-1', 'Google Workspace', 'plain-provider-key');
    `);
    database.close();

    expect(findPlaintextSecretRowsInSqlite(databasePath)).toEqual([
      {
        table_name: "model_configs",
        id: "model-1",
        name: "Gemini 主模型",
      },
      {
        table_name: "provider_connections",
        id: "connection-1",
        name: "Google Workspace",
      },
    ]);
  });

  it("passes cleanly when all stored secrets are encrypted", () => {
    const { database, databasePath } = createDatabaseFile();

    database.exec(`
      INSERT INTO model_configs (id, name, api_key) VALUES ('model-1', 'Gemini 主模型', 'enc:v1:abc');
      INSERT INTO provider_connections (id, name, api_key) VALUES ('connection-1', 'Google Workspace', 'enc:v1:def');
    `);
    database.close();

    expect(() => assertNoPlaintextSecretsInSqliteDatabase(`file:${databasePath}`)).not.toThrow();
  });
});
