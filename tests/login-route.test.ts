import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimitStore } from "@/server/http/rate-limit";

const originalEnv = {
  ENABLE_API_RATE_LIMITS: process.env.ENABLE_API_RATE_LIMITS,
  API_RATE_LIMIT_WINDOW_SECONDS: process.env.API_RATE_LIMIT_WINDOW_SECONDS,
  API_RATE_LIMIT_MAX_LOGIN_ATTEMPTS: process.env.API_RATE_LIMIT_MAX_LOGIN_ATTEMPTS,
  APP_LOGIN_ENABLED: process.env.APP_LOGIN_ENABLED,
  APP_LOGIN_USERNAME: process.env.APP_LOGIN_USERNAME,
  APP_LOGIN_PASSWORD: process.env.APP_LOGIN_PASSWORD,
  APP_LOGIN_SESSION_SECRET: process.env.APP_LOGIN_SESSION_SECRET,
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    resetRateLimitStore();
    process.env.ENABLE_API_RATE_LIMITS = "true";
    process.env.API_RATE_LIMIT_WINDOW_SECONDS = "60";
    process.env.API_RATE_LIMIT_MAX_LOGIN_ATTEMPTS = "5";
    process.env.APP_LOGIN_ENABLED = "true";
    process.env.APP_LOGIN_USERNAME = "longyu";
    process.env.APP_LOGIN_PASSWORD = "correct-secret";
    process.env.APP_LOGIN_SESSION_SECRET = "session-secret";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    resetRateLimitStore();
    vi.resetModules();
  });

  it("rate limits repeated failed login attempts from the same client", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const requestInit = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        username: "longyu",
        password: "wrong-secret",
      }),
    } satisfies RequestInit;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(new Request("https://example.com/api/auth/login", requestInit));
      expect(response.status).toBe(401);
    }

    const limited = await POST(new Request("https://example.com/api/auth/login", requestInit));

    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({
      error: "Too many requests. Please wait and try again.",
    });
  });
});
