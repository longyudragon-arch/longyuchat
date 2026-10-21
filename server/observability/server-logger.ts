import fs from "node:fs";
import path from "node:path";

import { getAppLogDir, isFileLoggingEnabled } from "@/lib/runtime";

const apiKeyJsonPattern = /("apiKey"\s*:\s*")([^"]+)(")/gi;
const apiKeyLabelPattern = /\b(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi;
const bearerTokenPattern = /\b(authorization\s*:\s*bearer\s+)([^\s,;]+)/gi;
const openAiKeyPattern = /\bsk-[A-Za-z0-9_-]{10,}\b/g;
const googleApiKeyPattern = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const secretFieldPattern = /^(?:api[_-]?key|authorization|proxy[_-]?authorization|password|passwd|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|token|cookie|set[_-]?cookie|session[_-]?secret|model[_-]?secret[_-]?encryption[_-]?key)$/i;

function redactSecretsInString(value: string) {
  return value
    .replace(apiKeyJsonPattern, `$1[REDACTED]$3`)
    .replace(apiKeyLabelPattern, `$1[REDACTED]`)
    .replace(bearerTokenPattern, `$1[REDACTED]`)
    .replace(openAiKeyPattern, "[REDACTED]")
    .replace(googleApiKeyPattern, "[REDACTED]");
}

export function sanitizeForLogging(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecretsInString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogging(item));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecretsInString(value.message),
      stack: value.stack ? redactSecretsInString(value.stack) : undefined,
    };
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        secretFieldPattern.test(key) ? "[REDACTED]" : sanitizeForLogging(entryValue),
      ]),
    );
  }

  return value;
}

function getLoggerForLevel(level: "info" | "warn" | "error") {
  if (level === "error") {
    return console.error;
  }

  if (level === "warn") {
    return console.warn;
  }

  return console.info;
}

function getDailyLogFilePath(now = new Date()) {
  const logDirectory = getAppLogDir();

  if (!logDirectory) {
    return null;
  }

  const dateStamp = now.toISOString().slice(0, 10);
  return path.join(logDirectory, `server-${dateStamp}.log`);
}

function writeLogLine(line: string) {
  if (!isFileLoggingEnabled()) {
    return;
  }

  const logFilePath = getDailyLogFilePath();

  if (!logFilePath) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "file_log_write_failed",
        message: error instanceof Error ? error.message : "Could not write the server log file.",
      }),
    );
  }
}

export function logServerEvent(level: "info" | "warn" | "error", event: string, payload?: Record<string, unknown>) {
  const entry = sanitizeForLogging({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(payload ?? {}),
  });
  const serialized = JSON.stringify(entry);
  const logger = getLoggerForLevel(level);

  logger(serialized);
  writeLogLine(serialized);
}

interface LogRouteErrorInput {
  requestId: string;
  request?: Pick<Request, "method" | "url">;
  status: number;
  error: unknown;
  details?: unknown;
}

export function logRouteError(input: LogRouteErrorInput) {
  logServerEvent(input.status >= 500 ? "error" : "warn", "api_error", {
    requestId: input.requestId,
    method: input.request?.method,
    url: input.request?.url,
    status: input.status,
    error: input.error,
    details: input.details,
  });
}
