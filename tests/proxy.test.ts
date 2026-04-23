import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  APP_LOGIN_ENABLED: process.env.APP_LOGIN_ENABLED,
  APP_LOGIN_USERNAME: process.env.APP_LOGIN_USERNAME,
  APP_LOGIN_PASSWORD: process.env.APP_LOGIN_PASSWORD,
  APP_LOGIN_SESSION_SECRET: process.env.APP_LOGIN_SESSION_SECRET,
  BASIC_AUTH_ENABLED: process.env.BASIC_AUTH_ENABLED,
  BASIC_AUTH_USERNAME: process.env.BASIC_AUTH_USERNAME,
  BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
  ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION: process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION,
};

describe("proxy access protection", () => {
  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    vi.resetModules();
  });

  it("fails closed in production when no protection mode is configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_LOGIN_ENABLED = "false";
    process.env.BASIC_AUTH_ENABLED = "false";
    process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION = "false";
    vi.resetModules();

    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("https://example.com/models"));

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toContain("auth required");
  });

  it("keeps the explicit production bypass working when allowed", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_LOGIN_ENABLED = "false";
    process.env.BASIC_AUTH_ENABLED = "false";
    process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION = "true";
    vi.resetModules();

    const { proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("https://example.com/models"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects cross-site API mutations in app-login mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_LOGIN_ENABLED = "true";
    process.env.APP_LOGIN_USERNAME = "longyu";
    process.env.APP_LOGIN_PASSWORD = "secret";
    process.env.APP_LOGIN_SESSION_SECRET = "session-secret";
    process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION = "false";
    vi.resetModules();

    const { proxy } = await import("@/proxy");
    const response = await proxy(
      new NextRequest("https://example.com/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "longyu",
          password: "secret",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("rejects non-JSON API mutations before they reach the route", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_LOGIN_ENABLED = "true";
    process.env.APP_LOGIN_USERNAME = "longyu";
    process.env.APP_LOGIN_PASSWORD = "secret";
    process.env.APP_LOGIN_SESSION_SECRET = "session-secret";
    process.env.ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION = "false";
    vi.resetModules();

    const { proxy } = await import("@/proxy");
    const response = await proxy(
      new NextRequest("https://example.com/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://example.com",
          "content-type": "text/plain",
        },
        body: '{"username":"longyu","password":"secret"}',
      }),
    );

    expect(response.status).toBe(415);
  });
});
