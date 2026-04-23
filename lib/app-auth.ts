import { constantTimeEqual, isServerAccessProtectionEnabled } from "@/lib/server-access";

export const APP_SESSION_COOKIE_NAME = "longyu_chat_session";
export type AccessProtectionMode = "app" | "basic" | "none";
const APP_SESSION_TOKEN_VERSION = 1;

interface AppSessionTokenPayload {
  v: number;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  credentialHash: string;
}

interface AppSessionTimingOptions {
  nowMs?: number;
  jti?: string;
}

declare global {
  var longyuChatRevokedSessionStore: Map<string, number> | undefined;
}

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

function toBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");

  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = normalized.padEnd(normalized.length + padding, "=");
  const binary = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toBase64Url(digest);
}

async function signTokenComponent(input: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return toBase64Url(signature);
}

function getRevokedSessionStore() {
  if (!globalThis.longyuChatRevokedSessionStore) {
    globalThis.longyuChatRevokedSessionStore = new Map<string, number>();
  }

  return globalThis.longyuChatRevokedSessionStore;
}

function pruneRevokedSessions(nowMs: number) {
  const store = getRevokedSessionStore();

  for (const [jti, expiresAtMs] of store.entries()) {
    if (expiresAtMs <= nowMs) {
      store.delete(jti);
    }
  }
}

function isAppSessionTokenPayload(value: unknown): value is AppSessionTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.v === APP_SESSION_TOKEN_VERSION &&
    typeof record.sub === "string" &&
    typeof record.iat === "number" &&
    typeof record.exp === "number" &&
    typeof record.jti === "string" &&
    typeof record.credentialHash === "string"
  );
}

async function getCredentialHash(input: AppLoginEnv = {}) {
  const username = getAppLoginUsername(input.username);
  const password = getAppLoginPassword(input.password);
  const sessionSecret = getAppLoginSessionSecret(input.sessionSecret);

  if (!username || !password || !sessionSecret) {
    throw new Error("APP_LOGIN_USERNAME, APP_LOGIN_PASSWORD, and APP_LOGIN_SESSION_SECRET must all be configured.");
  }

  return sha256Base64Url(`v2:${username}:${password}:${sessionSecret}`);
}

async function readAppSessionPayload(
  cookieValue: string | undefined,
  input: AppLoginEnv = {},
  options: AppSessionTimingOptions = {},
) {
  if (!cookieValue || !isAppLoginEnabled(input)) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const sessionSecret = getAppLoginSessionSecret(input.sessionSecret);

  if (!sessionSecret) {
    return null;
  }

  const expectedSignature = await signTokenComponent(encodedPayload, sessionSecret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
  } catch {
    return null;
  }

  if (!isAppSessionTokenPayload(payload)) {
    return null;
  }

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);

  if (payload.exp <= nowSeconds) {
    return null;
  }

  const expectedUsername = getAppLoginUsername(input.username);
  const expectedCredentialHash = await getCredentialHash(input);

  if (!constantTimeEqual(payload.sub, expectedUsername) || !constantTimeEqual(payload.credentialHash, expectedCredentialHash)) {
    return null;
  }

  pruneRevokedSessions(options.nowMs ?? Date.now());

  if (getRevokedSessionStore().has(payload.jti)) {
    return null;
  }

  return payload;
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

export async function createAppSessionToken(input: AppLoginEnv = {}, options: AppSessionTimingOptions = {}) {
  const username = getAppLoginUsername(input.username);
  const sessionSecret = getAppLoginSessionSecret(input.sessionSecret);

  if (!username || !sessionSecret) {
    throw new Error("APP_LOGIN_USERNAME, APP_LOGIN_PASSWORD, and APP_LOGIN_SESSION_SECRET must all be configured.");
  }

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const payload: AppSessionTokenPayload = {
    v: APP_SESSION_TOKEN_VERSION,
    sub: username,
    iat: nowSeconds,
    exp: nowSeconds + getAppLoginSessionMaxAgeSeconds(input.sessionMaxAgeSeconds),
    jti: options.jti ?? crypto.randomUUID(),
    credentialHash: await getCredentialHash(input),
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signTokenComponent(encodedPayload, sessionSecret);

  return `${encodedPayload}.${signature}`;
}

export async function isAppSessionAuthorized(
  cookieValue: string | undefined,
  input: AppLoginEnv = {},
  options: AppSessionTimingOptions = {},
) {
  return Boolean(await readAppSessionPayload(cookieValue, input, options));
}

export async function revokeAppSessionToken(
  cookieValue: string | undefined,
  input: AppLoginEnv = {},
  options: AppSessionTimingOptions = {},
) {
  const payload = await readAppSessionPayload(cookieValue, input, options);

  if (!payload) {
    return false;
  }

  const nowMs = options.nowMs ?? Date.now();
  pruneRevokedSessions(nowMs);
  getRevokedSessionStore().set(payload.jti, payload.exp * 1000);
  return true;
}

export function resetAppSessionRevocations() {
  getRevokedSessionStore().clear();
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
