import { ApiError } from "@/server/http/api-error";
import { parseBasicAuthHeader } from "@/lib/server-access";
import {
  areApiRateLimitsEnabled,
  getApiRateLimitMaxLoginAttempts,
  getApiRateLimitMaxMessagePosts,
  getApiRateLimitMaxModelDiscovery,
  getApiRateLimitMaxModelTests,
  getApiRateLimitWindowSeconds,
} from "@/lib/runtime";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowSeconds?: number;
  enabled?: boolean;
  now?: number;
  store?: Map<string, RateLimitEntry>;
}

declare global {
  var __aiChatLabRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

function getRateLimitStore() {
  if (!globalThis.__aiChatLabRateLimitStore) {
    globalThis.__aiChatLabRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return globalThis.__aiChatLabRateLimitStore;
}

function pruneExpiredEntries(store: Map<string, RateLimitEntry>, now: number) {
  if (store.size < 500) {
    return;
  }

  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstAddress = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (firstAddress) {
      return firstAddress;
    }
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("fly-client-ip") ??
    null
  );
}

export function getRateLimitPrincipal(request: Request) {
  const authorization = request.headers.get("authorization");
  const basicCredentials = parseBasicAuthHeader(authorization);

  if (basicCredentials?.username) {
    return `basic:${basicCredentials.username}`;
  }

  const ipAddress = getClientIpAddress(request);

  if (ipAddress) {
    return `ip:${ipAddress}`;
  }

  return "anonymous";
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  options?: {
    now?: number;
    store?: Map<string, RateLimitEntry>;
  },
) {
  const now = options?.now ?? Date.now();
  const store = options?.store ?? getRateLimitStore();
  const windowMs = windowSeconds * 1000;
  pruneExpiredEntries(store, now);

  const existing = store.get(key);
  const entry =
    !existing || existing.resetAt <= now
      ? {
          count: 0,
          resetAt: now + windowMs,
        }
      : existing;

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    return {
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
      resetAt: entry.resetAt,
    } as const;
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(limit - entry.count, 0),
    resetAt: entry.resetAt,
  } as const;
}

export function assertRateLimit(request: Request, options: RateLimitOptions) {
  const enabled = options.enabled ?? areApiRateLimitsEnabled();

  if (!enabled) {
    return;
  }

  const windowSeconds = options.windowSeconds ?? getApiRateLimitWindowSeconds();
  const principal = getRateLimitPrincipal(request);
  const key = `${options.bucket}:${principal}`;
  const result = consumeRateLimit(key, options.limit, windowSeconds, {
    now: options.now,
    store: options.store,
  });

  if (!result.allowed) {
    throw new ApiError(429, "Too many requests. Please wait and try again.", {
      bucket: options.bucket,
      limit: options.limit,
      windowSeconds,
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

export function assertMessagePostRateLimit(request: Request) {
  assertRateLimit(request, {
    bucket: "room-message-posts",
    limit: getApiRateLimitMaxMessagePosts(),
  });
}

export function assertModelTestRateLimit(request: Request) {
  assertRateLimit(request, {
    bucket: "model-test-posts",
    limit: getApiRateLimitMaxModelTests(),
  });
}

export function assertModelDiscoveryRateLimit(request: Request) {
  assertRateLimit(request, {
    bucket: "model-discovery-posts",
    limit: getApiRateLimitMaxModelDiscovery(),
  });
}

export function assertLoginRateLimit(request: Request) {
  assertRateLimit(request, {
    bucket: "app-login-posts",
    limit: getApiRateLimitMaxLoginAttempts(),
  });
}

export function resetRateLimitStore() {
  getRateLimitStore().clear();
}
