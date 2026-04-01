import "dotenv/config";

import { spawn } from "node:child_process";

function parseBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function areDevMocksDisabled() {
  const server = parseBoolean(process.env.ENABLE_DEV_MOCKS);
  const client = parseBoolean(process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS);

  return server === false && client === false;
}

function isAppLoginEnabled() {
  const explicit = parseBoolean(process.env.APP_LOGIN_ENABLED);
  const configured = Boolean(
    process.env.APP_LOGIN_USERNAME?.trim() &&
      process.env.APP_LOGIN_PASSWORD?.trim() &&
      process.env.APP_LOGIN_SESSION_SECRET?.trim(),
  );

  if (explicit === false) {
    return false;
  }

  return configured;
}

function isBasicAuthEnabled() {
  const explicit = parseBoolean(process.env.BASIC_AUTH_ENABLED);

  if (explicit !== undefined) {
    return explicit;
  }

  return Boolean(process.env.BASIC_AUTH_USERNAME?.trim() && process.env.BASIC_AUTH_PASSWORD?.trim());
}

function isRateLimitingEnabled() {
  const explicit = parseBoolean(process.env.ENABLE_API_RATE_LIMITS);
  return explicit ?? true;
}

function isFileLoggingEnabled() {
  const explicit = parseBoolean(process.env.ENABLE_FILE_LOGGING);
  return explicit ?? true;
}

function getLogDirectory() {
  return process.env.APP_LOG_DIR?.trim() || "var/log";
}

function getSqliteBackupDirectory() {
  return process.env.SQLITE_BACKUP_DIR?.trim() || "var/backups/sqlite";
}

function isModelSecretEncryptionConfigured() {
  return Boolean(process.env.MODEL_SECRET_ENCRYPTION_KEY?.trim());
}

function isUnprotectedAccessAllowed() {
  return parseBoolean(process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION) ?? false;
}

function getListenHost() {
  return process.env.APP_LISTEN_HOST?.trim() || "127.0.0.1";
}

function getAccessProtectionMode() {
  if (isAppLoginEnabled()) {
    return "app";
  }

  if (isBasicAuthEnabled()) {
    return "basic";
  }

  return "none";
}

function isSqliteDatabaseUrl(databaseUrl) {
  return databaseUrl?.startsWith("file:");
}

function validateProductionReadiness() {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";

  const issues = [];

  if (!process.env.DATABASE_URL?.trim()) {
    issues.push("DATABASE_URL is not configured.");
  }

  if (!areDevMocksDisabled()) {
    issues.push("ENABLE_DEV_MOCKS and NEXT_PUBLIC_ENABLE_DEV_MOCKS must both be false in production.");
  }

  if (getAccessProtectionMode() === "none" && !isUnprotectedAccessAllowed()) {
    issues.push(
      "Access protection is not enabled. Configure APP_LOGIN_* or BASIC_AUTH_* variables, or set ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION=true.",
    );
  }

  if (!isModelSecretEncryptionConfigured()) {
    issues.push("MODEL_SECRET_ENCRYPTION_KEY must be configured in production.");
  }

  if (!isRateLimitingEnabled()) {
    issues.push("ENABLE_API_RATE_LIMITS must stay enabled in production.");
  }

  if (!isFileLoggingEnabled() || !getLogDirectory()) {
    issues.push("ENABLE_FILE_LOGGING must stay enabled in production and APP_LOG_DIR must resolve to a directory.");
  }

  if (isSqliteDatabaseUrl(process.env.DATABASE_URL) && !getSqliteBackupDirectory()) {
    issues.push("SQLite backup directory could not be resolved.");
  }

  if (issues.length > 0) {
    process.stderr.write(`Production readiness check failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}\n`);
    process.exit(1);
  }
}

function startNextServer() {
  const nextCommand = process.platform === "win32" ? "next.cmd" : "next";
  const child = spawn(nextCommand, ["start", "-H", getListenHost()], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

validateProductionReadiness();
startNextServer();
