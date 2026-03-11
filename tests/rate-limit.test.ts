import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "@/server/http/api-error";
import {
  assertRateLimit,
  consumeRateLimit,
  getRateLimitPrincipal,
  resetRateLimitStore,
} from "@/server/http/rate-limit";

function buildRequest(input?: {
  authorization?: string;
  forwardedFor?: string;
  realIp?: string;
}) {
  const headers = new Headers();

  if (input?.authorization) {
    headers.set("authorization", input.authorization);
  }

  if (input?.forwardedFor) {
    headers.set("x-forwarded-for", input.forwardedFor);
  }

  if (input?.realIp) {
    headers.set("x-real-ip", input.realIp);
  }

  return new Request("https://example.com/api/rooms/room-1/messages", {
    method: "POST",
    headers,
  });
}

describe("getRateLimitPrincipal", () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  it("prefers the authenticated Basic Auth username", () => {
    const header = `Basic ${Buffer.from("demo:secret").toString("base64")}`;
    const request = buildRequest({
      authorization: header,
      forwardedFor: "203.0.113.10",
    });

    expect(getRateLimitPrincipal(request)).toBe("basic:demo");
  });

  it("falls back to the first forwarded IP address", () => {
    const request = buildRequest({
      forwardedFor: "203.0.113.10, 10.0.0.2",
    });

    expect(getRateLimitPrincipal(request)).toBe("ip:203.0.113.10");
  });
});

describe("consumeRateLimit", () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  it("allows requests until the configured limit is reached", () => {
    const store = new Map();

    expect(consumeRateLimit("bucket:user-1", 2, 60, { now: 1000, store }).allowed).toBe(true);
    expect(consumeRateLimit("bucket:user-1", 2, 60, { now: 2000, store }).allowed).toBe(true);

    const limited = consumeRateLimit("bucket:user-1", 2, 60, { now: 3000, store });

    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the bucket after the window elapses", () => {
    const store = new Map();

    expect(consumeRateLimit("bucket:user-2", 1, 60, { now: 1000, store }).allowed).toBe(true);
    expect(consumeRateLimit("bucket:user-2", 1, 60, { now: 2000, store }).allowed).toBe(false);
    expect(consumeRateLimit("bucket:user-2", 1, 60, { now: 62000, store }).allowed).toBe(true);
  });
});

describe("assertRateLimit", () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  it("throws a 429 ApiError when the current principal exceeds the limit", () => {
    const store = new Map();
    const request = buildRequest({
      forwardedFor: "203.0.113.20",
    });

    assertRateLimit(request, {
      bucket: "room-message-posts",
      limit: 1,
      windowSeconds: 60,
      now: 1000,
      store,
      enabled: true,
    });

    expect(() =>
      assertRateLimit(request, {
        bucket: "room-message-posts",
        limit: 1,
        windowSeconds: 60,
        now: 2000,
        store,
        enabled: true,
      }),
    ).toThrowError(
      expect.objectContaining<ApiError>({
        status: 429,
        message: "Too many requests. Please wait and try again.",
      }),
    );
  });

  it("becomes a no-op when rate limits are disabled", () => {
    const store = new Map();
    const request = buildRequest({
      forwardedFor: "203.0.113.30",
    });

    expect(() =>
      assertRateLimit(request, {
        bucket: "room-message-posts",
        limit: 1,
        enabled: false,
        now: 1000,
        store,
      }),
    ).not.toThrow();
  });
});
