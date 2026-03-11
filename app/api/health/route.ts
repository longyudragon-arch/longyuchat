import { prisma } from "@/lib/prisma";
import {
  areApiRateLimitsEnabled,
  areDevMocksEnabledForServer,
  getAppLogDir,
  getSqliteBackupDir,
  isFileLoggingEnabled,
} from "@/lib/runtime";
import { buildProductionReadinessReport } from "@/server/config/production-readiness";
import { jsonWithRequestId } from "@/server/http/api-response";
import { isModelSecretEncryptionConfigured } from "@/server/security/model-secret-crypto";

export async function GET(request: Request) {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    const readiness = buildProductionReadinessReport();

    return jsonWithRequestId(request, {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      database: "up",
      devMocksEnabled: areDevMocksEnabledForServer(),
      apiRateLimitsEnabled: areApiRateLimitsEnabled(),
      fileLoggingEnabled: isFileLoggingEnabled(),
      logDirectory: readiness.checks.logDirectory ?? getAppLogDir() ?? null,
      sqliteBackupConfigured: readiness.checks.sqliteBackupConfigured,
      sqliteBackupDirectory: readiness.checks.sqliteBackupDirectory ?? getSqliteBackupDir() ?? null,
      modelSecretEncryptionConfigured: isModelSecretEncryptionConfigured(),
      productionReadiness: readiness,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database health check failed.";
    const readiness = buildProductionReadinessReport();

    return jsonWithRequestId(
      request,
      {
        status: "error",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? "development",
        database: "down",
        devMocksEnabled: areDevMocksEnabledForServer(),
        apiRateLimitsEnabled: areApiRateLimitsEnabled(),
        fileLoggingEnabled: isFileLoggingEnabled(),
        logDirectory: readiness.checks.logDirectory ?? getAppLogDir() ?? null,
        sqliteBackupConfigured: readiness.checks.sqliteBackupConfigured,
        sqliteBackupDirectory: readiness.checks.sqliteBackupDirectory ?? getSqliteBackupDir() ?? null,
        modelSecretEncryptionConfigured: isModelSecretEncryptionConfigured(),
        productionReadiness: readiness,
        error: message,
      },
      { status: 503 },
    );
  }
}
