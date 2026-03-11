import { getAccessProtectionMode, isAppLoginEnabled } from "@/lib/app-auth";
import { isServerAccessProtectionEnabled } from "@/lib/server-access";
import {
  areApiRateLimitsEnabled,
  areDevMocksEnabledForClient,
  areDevMocksEnabledForServer,
  getAppLogDir,
  getSqliteBackupDir,
  isFileLoggingEnabled,
  isUnprotectedAccessAllowedInProduction,
} from "@/lib/runtime";
import { isModelSecretEncryptionConfigured } from "@/server/security/model-secret-crypto";

export interface ProductionReadinessReport {
  ready: boolean;
  issues: string[];
  warnings: string[];
    checks: {
      databaseConfigured: boolean;
      devMocksDisabled: boolean;
      accessProtectionMode: "app" | "basic" | "none";
      accessProtectionEnabled: boolean;
      appLoginEnabled: boolean;
      basicAuthEnabled: boolean;
      unprotectedAccessAllowed: boolean;
      modelSecretEncryptionConfigured: boolean;
      apiRateLimitsEnabled: boolean;
    fileLoggingEnabled: boolean;
    logDirectory: string | null;
    sqliteBackupConfigured: boolean;
    sqliteBackupDirectory: string | null;
    healthcheckBearerConfigured: boolean;
  };
}

function isProduction(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

function isSqliteUrl(databaseUrl: string | undefined) {
  return Boolean(databaseUrl?.startsWith("file:"));
}

export function buildProductionReadinessReport(env = process.env): ProductionReadinessReport {
  const inProduction = isProduction(env.NODE_ENV);

  if (!inProduction) {
    return {
      ready: true,
      issues: [],
      warnings: [],
      checks: {
        databaseConfigured: Boolean(env.DATABASE_URL),
        devMocksDisabled: !areDevMocksEnabledForServer(env.NODE_ENV, env.ENABLE_DEV_MOCKS),
        accessProtectionMode: getAccessProtectionMode(env),
        accessProtectionEnabled: getAccessProtectionMode(env) !== "none",
        appLoginEnabled: isAppLoginEnabled({
          enabled: env.APP_LOGIN_ENABLED,
          username: env.APP_LOGIN_USERNAME,
          password: env.APP_LOGIN_PASSWORD,
          sessionSecret: env.APP_LOGIN_SESSION_SECRET,
        }),
        basicAuthEnabled: isServerAccessProtectionEnabled({
          enabled: env.BASIC_AUTH_ENABLED,
          username: env.BASIC_AUTH_USERNAME,
          password: env.BASIC_AUTH_PASSWORD,
        }),
        unprotectedAccessAllowed: isUnprotectedAccessAllowedInProduction(env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION),
        modelSecretEncryptionConfigured: isModelSecretEncryptionConfigured(env.MODEL_SECRET_ENCRYPTION_KEY),
        apiRateLimitsEnabled: areApiRateLimitsEnabled(env.NODE_ENV, env.ENABLE_API_RATE_LIMITS),
        fileLoggingEnabled: isFileLoggingEnabled(env.NODE_ENV, env.ENABLE_FILE_LOGGING),
        logDirectory: getAppLogDir(env.NODE_ENV, env.APP_LOG_DIR) ?? null,
        sqliteBackupConfigured: Boolean(getSqliteBackupDir(env.NODE_ENV, env.SQLITE_BACKUP_DIR)),
        sqliteBackupDirectory: getSqliteBackupDir(env.NODE_ENV, env.SQLITE_BACKUP_DIR) ?? null,
        healthcheckBearerConfigured: Boolean(env.HEALTHCHECK_BEARER_TOKEN?.trim()),
      },
    };
  }

  const databaseConfigured = Boolean(env.DATABASE_URL?.trim());
  const serverDevMocksEnabled = areDevMocksEnabledForServer(env.NODE_ENV, env.ENABLE_DEV_MOCKS);
  const clientDevMocksEnabled = areDevMocksEnabledForClient(env.NODE_ENV, env.NEXT_PUBLIC_ENABLE_DEV_MOCKS);
  const devMocksDisabled = !serverDevMocksEnabled && !clientDevMocksEnabled;
  const accessProtectionMode = getAccessProtectionMode(env);
  const appLoginEnabled = isAppLoginEnabled({
    enabled: env.APP_LOGIN_ENABLED,
    username: env.APP_LOGIN_USERNAME,
    password: env.APP_LOGIN_PASSWORD,
    sessionSecret: env.APP_LOGIN_SESSION_SECRET,
  });
  const basicAuthEnabled = isServerAccessProtectionEnabled({
    enabled: env.BASIC_AUTH_ENABLED,
    username: env.BASIC_AUTH_USERNAME,
    password: env.BASIC_AUTH_PASSWORD,
  });
  const accessProtectionEnabled = accessProtectionMode !== "none";
  const unprotectedAccessAllowed = isUnprotectedAccessAllowedInProduction(env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION);
  const modelSecretEncryptionConfigured = isModelSecretEncryptionConfigured(env.MODEL_SECRET_ENCRYPTION_KEY);
  const apiRateLimitsEnabled = areApiRateLimitsEnabled(env.NODE_ENV, env.ENABLE_API_RATE_LIMITS);
  const fileLoggingEnabled = isFileLoggingEnabled(env.NODE_ENV, env.ENABLE_FILE_LOGGING);
  const logDirectory = getAppLogDir(env.NODE_ENV, env.APP_LOG_DIR) ?? null;
  const sqliteBackupDirectory = getSqliteBackupDir(env.NODE_ENV, env.SQLITE_BACKUP_DIR) ?? null;
  const sqliteBackupConfigured = isSqliteUrl(env.DATABASE_URL) ? Boolean(sqliteBackupDirectory) : true;
  const healthcheckBearerConfigured = Boolean(env.HEALTHCHECK_BEARER_TOKEN?.trim());

  const issues: string[] = [];
  const warnings: string[] = [];

  if (!databaseConfigured) {
    issues.push("DATABASE_URL is not configured.");
  }

  if (!devMocksDisabled) {
    issues.push("ENABLE_DEV_MOCKS and NEXT_PUBLIC_ENABLE_DEV_MOCKS must both be disabled in production.");
  }

  if (!accessProtectionEnabled && !unprotectedAccessAllowed) {
    issues.push(
      "Access protection is not enabled. Configure APP_LOGIN_* or BASIC_AUTH_* variables, or explicitly allow unprotected access.",
    );
  }

  if (!modelSecretEncryptionConfigured) {
    issues.push("MODEL_SECRET_ENCRYPTION_KEY must be configured in production.");
  }

  if (!apiRateLimitsEnabled) {
    issues.push("ENABLE_API_RATE_LIMITS should stay enabled in production.");
  }

  if (!fileLoggingEnabled || !logDirectory) {
    issues.push("File logging must be enabled in production and APP_LOG_DIR must resolve to a writable directory.");
  }

  if (!sqliteBackupConfigured) {
    issues.push("SQLite backups are not configured. Set SQLITE_BACKUP_DIR for production SQLite deployments.");
  }

  if (!healthcheckBearerConfigured) {
    warnings.push("HEALTHCHECK_BEARER_TOKEN is not configured. Health probes will rely on login-protected routes only.");
  }

  if (!accessProtectionEnabled && unprotectedAccessAllowed) {
    warnings.push("Production access protection is explicitly bypassed.");
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    checks: {
      databaseConfigured,
      devMocksDisabled,
      accessProtectionMode,
      accessProtectionEnabled,
      appLoginEnabled,
      basicAuthEnabled,
      unprotectedAccessAllowed,
      modelSecretEncryptionConfigured,
      apiRateLimitsEnabled,
      fileLoggingEnabled,
      logDirectory,
      sqliteBackupConfigured,
      sqliteBackupDirectory,
      healthcheckBearerConfigured,
    },
  };
}

export function assertProductionReadiness(env = process.env) {
  const report = buildProductionReadinessReport(env);

  if (!report.ready) {
    throw new Error(
      `Production readiness check failed:\n${report.issues.map((issue) => `- ${issue}`).join("\n")}`,
    );
  }

  return report;
}
