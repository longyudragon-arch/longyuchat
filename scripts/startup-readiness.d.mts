export interface PlaintextSecretRow {
  table_name: "model_configs" | "provider_connections";
  id: string;
  name: string;
}

export function findPlaintextSecretRowsInSqlite(databasePath: string): PlaintextSecretRow[];
export function assertNoPlaintextSecretsInSqliteDatabase(databaseUrl?: string): PlaintextSecretRow[];
