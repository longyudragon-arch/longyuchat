import path from "node:path";
import Database from "better-sqlite3";

function normalizeFileDatabasePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    return null;
  }

  const rawPath = databaseUrl.slice("file:".length);

  if (!rawPath) {
    return null;
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

export function findPlaintextSecretRowsInSqlite(databasePath) {
  const database = new Database(databasePath, { readonly: true });

  try {
    const query = `
      SELECT 'model_configs' AS table_name, id, name
      FROM model_configs
      WHERE api_key IS NOT NULL
        AND TRIM(api_key) <> ''
        AND api_key NOT LIKE 'enc:v1:%'
      UNION ALL
      SELECT 'provider_connections' AS table_name, id, name
      FROM provider_connections
      WHERE api_key IS NOT NULL
        AND TRIM(api_key) <> ''
        AND api_key NOT LIKE 'enc:v1:%'
    `;

    return database.prepare(query).all();
  } finally {
    database.close();
  }
}

export function assertNoPlaintextSecretsInSqliteDatabase(databaseUrl) {
  const databasePath = normalizeFileDatabasePath(databaseUrl);

  if (!databasePath) {
    return [];
  }

  const plaintextRows = findPlaintextSecretRowsInSqlite(databasePath);

  if (plaintextRows.length > 0) {
    const summary = plaintextRows
      .slice(0, 10)
      .map((row) => `- ${row.table_name}:${row.id} (${row.name})`)
      .join("\n");

    throw new Error(
      `Production secret scan failed. Re-encrypt stored API keys before startup:\n${summary}`,
    );
  }

  return [];
}
