-- CreateTable
CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "discovery_strategy" TEXT NOT NULL DEFAULT 'AUTO_FETCH_WITH_MANUAL_FALLBACK',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_auth_status" TEXT,
    "last_auth_message" TEXT,
    "last_auth_checked_at" DATETIME,
    "last_discovery_status" TEXT,
    "last_discovery_message" TEXT,
    "last_discovered_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_model_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "connection_id" TEXT,
    "provider" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "default_reply_length" INTEGER NOT NULL DEFAULT 300,
    "last_test_status" TEXT,
    "last_test_message" TEXT,
    "last_tested_at" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "model_configs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "provider_connections" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_model_configs" (
    "api_key",
    "base_url",
    "created_at",
    "default_reply_length",
    "enabled",
    "id",
    "last_test_message",
    "last_test_status",
    "last_tested_at",
    "model_name",
    "name",
    "provider",
    "updated_at"
) SELECT
    "api_key",
    "base_url",
    "created_at",
    "default_reply_length",
    "enabled",
    "id",
    "last_test_message",
    "last_test_status",
    "last_tested_at",
    "model_name",
    "name",
    "provider",
    "updated_at"
FROM "model_configs";
DROP TABLE "model_configs";
ALTER TABLE "new_model_configs" RENAME TO "model_configs";
CREATE UNIQUE INDEX "model_configs_name_key" ON "model_configs"("name");
CREATE INDEX "model_configs_connection_id_idx" ON "model_configs"("connection_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_name_key" ON "provider_connections"("name");
