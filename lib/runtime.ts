function parseBooleanEnv(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseTrimmedStringEnv(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parsePositiveIntegerEnv(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value.trim(), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function areDevMocksEnabledForServer(
  nodeEnv = process.env.NODE_ENV,
  explicitValue = process.env.ENABLE_DEV_MOCKS,
) {
  const parsed = parseBooleanEnv(explicitValue);

  if (parsed !== undefined) {
    return parsed;
  }

  return nodeEnv !== "production";
}

export function areApiRateLimitsEnabled(
  nodeEnv = process.env.NODE_ENV,
  explicitValue = process.env.ENABLE_API_RATE_LIMITS,
) {
  const parsed = parseBooleanEnv(explicitValue);

  if (parsed !== undefined) {
    return parsed;
  }

  return nodeEnv === "production";
}

export function getApiRateLimitWindowSeconds(explicitValue = process.env.API_RATE_LIMIT_WINDOW_SECONDS) {
  return parsePositiveIntegerEnv(explicitValue) ?? 60;
}

export function getApiRateLimitMaxMessagePosts(
  explicitValue = process.env.API_RATE_LIMIT_MAX_MESSAGE_POSTS,
) {
  return parsePositiveIntegerEnv(explicitValue) ?? 12;
}

export function getApiRateLimitMaxModelTests(
  explicitValue = process.env.API_RATE_LIMIT_MAX_MODEL_TESTS,
) {
  return parsePositiveIntegerEnv(explicitValue) ?? 10;
}

export function getApiRateLimitMaxModelDiscovery(
  explicitValue = process.env.API_RATE_LIMIT_MAX_MODEL_DISCOVERY,
) {
  return parsePositiveIntegerEnv(explicitValue) ?? 20;
}

export function isFileLoggingEnabled(
  nodeEnv = process.env.NODE_ENV,
  explicitValue = process.env.ENABLE_FILE_LOGGING,
) {
  const parsed = parseBooleanEnv(explicitValue);

  if (parsed !== undefined) {
    return parsed;
  }

  return nodeEnv === "production";
}

export function getAppLogDir(
  nodeEnv = process.env.NODE_ENV,
  explicitValue = process.env.APP_LOG_DIR,
) {
  const configured = parseTrimmedStringEnv(explicitValue);

  if (configured) {
    return configured;
  }

  if (nodeEnv === "production") {
    return "var/log";
  }

  return undefined;
}

export function getSqliteBackupDir(
  nodeEnv = process.env.NODE_ENV,
  explicitValue = process.env.SQLITE_BACKUP_DIR,
) {
  const configured = parseTrimmedStringEnv(explicitValue);

  if (configured) {
    return configured;
  }

  if (nodeEnv === "production") {
    return "var/backups/sqlite";
  }

  return undefined;
}

export function getSqliteBackupRetentionDays(explicitValue = process.env.SQLITE_BACKUP_RETENTION_DAYS) {
  return parsePositiveIntegerEnv(explicitValue) ?? 7;
}

export function isUnprotectedAccessAllowedInProduction(
  explicitValue = process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION,
) {
  return parseBooleanEnv(explicitValue) ?? false;
}

export function areDevMocksEnabledForClient(
  nodeEnv = process.env.NODE_ENV,
  explicitValue = process.env.NEXT_PUBLIC_ENABLE_DEV_MOCKS,
) {
  const parsed = parseBooleanEnv(explicitValue);

  if (parsed !== undefined) {
    return parsed;
  }

  return nodeEnv !== "production";
}
