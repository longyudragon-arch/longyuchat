import { isServerAccessProtectionEnabled } from "@/lib/server-access";

export const APP_SESSION_COOKIE_NAME = "longyu_chat_session";
export type AccessProtectionMode = "app" | "basic" | "none";

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

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");

  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toBase64Url(digest);
}

export interface AppLoginEnv {
  enabled?: string;
  username?: string;
  password?: string;
  sessionSecret?: string;
  sessionMaxAgeSeconds?: string;
}

export function getAppLoginUsername(explicitValue = process.env.APP_LOGIN_USERNAME) {
  return parseTrimmedStringEnv(explicitValue);
}

export function getAppLoginPassword(explicitValue = process.env.APP_LOGIN_PASSWORD) {
  return parseTrimmedStringEnv(explicitValue);
}

export function getAppLoginSessionSecret(explicitValue = process.env.APP_LOGIN_SESSION_SECRET) {
  return parseTrimmedStringEnv(explicitValue);
}

export function getAppLoginSessionMaxAgeSeconds(explicitValue = process.env.APP_LOGIN_SESSION_MAX_AGE_SECONDS) {
  return parsePositiveIntegerEnv(explicitValue) ?? 60 * 60 * 24 * 30;
}

export function isAppLoginEnabled(input: AppLoginEnv = {}) {
  const explicit = parseBooleanEnv(input.enabled ?? process.env.APP_LOGIN_ENABLED);
  const configured = Boolean(
    getAppLoginUsername(input.username) &&
      getAppLoginPassword(input.password) &&
      getAppLoginSessionSecret(input.sessionSecret),
  );

  if (explicit === false) {
    return false;
  }

  return configured;
}

export function getAccessProtectionMode(env: NodeJS.ProcessEnv = process.env): AccessProtectionMode {
  if (
    isAppLoginEnabled({
      enabled: env.APP_LOGIN_ENABLED,
      username: env.APP_LOGIN_USERNAME,
      password: env.APP_LOGIN_PASSWORD,
      sessionSecret: env.APP_LOGIN_SESSION_SECRET,
    })
  ) {
    return "app" as const;
  }

  if (
    isServerAccessProtectionEnabled({
      enabled: env.BASIC_AUTH_ENABLED,
      username: env.BASIC_AUTH_USERNAME,
      password: env.BASIC_AUTH_PASSWORD,
    })
  ) {
    return "basic" as const;
  }

  return "none";
}

export async function createAppSessionToken(input: AppLoginEnv = {}) {
  const username = getAppLoginUsername(input.username);
  const password = getAppLoginPassword(input.password);
  const sessionSecret = getAppLoginSessionSecret(input.sessionSecret);

  if (!username || !password || !sessionSecret) {
    throw new Error("APP_LOGIN_USERNAME, APP_LOGIN_PASSWORD, and APP_LOGIN_SESSION_SECRET must all be configured.");
  }

  return sha256Base64Url(`v1:${username}:${password}:${sessionSecret}`);
}

export async function isAppSessionAuthorized(
  cookieValue: string | undefined,
  input: AppLoginEnv = {},
) {
  if (!cookieValue || !isAppLoginEnabled(input)) {
    return false;
  }

  const expectedToken = await createAppSessionToken(input);
  return cookieValue === expectedToken;
}

export function resolveSafeNextPath(input: string | null | undefined) {
  if (!input) {
    return "/";
  }

  if (!input.startsWith("/") || input.startsWith("//")) {
    return "/";
  }

  if (input.startsWith("/login")) {
    return "/";
  }

  return input;
}
