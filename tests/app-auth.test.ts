import { afterEach, describe, expect, it } from "vitest";

import {
  APP_SESSION_COOKIE_NAME,
  createAppSessionToken,
  getAccessProtectionMode,
  isAppLoginEnabled,
  isAppSessionAuthorized,
  resetAppSessionRevocations,
  revokeAppSessionToken,
  resolveSafeNextPath,
} from "@/lib/app-auth";

describe("app auth helpers", () => {
  afterEach(() => {
    resetAppSessionRevocations();
  });

  it("detects app login when credentials and session secret are configured", () => {
    expect(
      isAppLoginEnabled({
        username: "longyu",
        password: "secret",
        sessionSecret: "session-secret",
      }),
    ).toBe(true);
  });

  it("creates signed session tokens, validates them, and supports revocation", async () => {
    const input = {
      username: "longyu",
      password: "secret",
      sessionSecret: "session-secret",
    };

    const firstToken = await createAppSessionToken(input, { nowMs: 1_000 });
    const secondToken = await createAppSessionToken(input, { nowMs: 1_000 });

    expect(firstToken.length).toBeGreaterThan(20);
    expect(secondToken.length).toBeGreaterThan(20);
    expect(firstToken).not.toBe(secondToken);

    expect(await isAppSessionAuthorized(firstToken, input, { nowMs: 2_000 })).toBe(true);
    expect(await isAppSessionAuthorized(`${firstToken}-wrong`, input, { nowMs: 2_000 })).toBe(false);

    await revokeAppSessionToken(firstToken, input, { nowMs: 2_000 });

    expect(await isAppSessionAuthorized(firstToken, input, { nowMs: 2_000 })).toBe(false);
    expect(await isAppSessionAuthorized(secondToken, input, { nowMs: 2_000 })).toBe(true);
  });

  it("prefers app login over basic auth when both are configured", () => {
    expect(
      getAccessProtectionMode({
        NODE_ENV: "test",
        APP_LOGIN_ENABLED: "true",
        APP_LOGIN_USERNAME: "longyu",
        APP_LOGIN_PASSWORD: "secret",
        APP_LOGIN_SESSION_SECRET: "session-secret",
        BASIC_AUTH_ENABLED: "true",
        BASIC_AUTH_USERNAME: "admin",
        BASIC_AUTH_PASSWORD: "secret",
      }),
    ).toBe("app");
  });

  it("keeps next paths on-site and blocks login loops", () => {
    expect(APP_SESSION_COOKIE_NAME).toBe("longyu_chat_session");
    expect(resolveSafeNextPath("/rooms/123")).toBe("/rooms/123");
    expect(resolveSafeNextPath("https://example.com")).toBe("/");
    expect(resolveSafeNextPath("/login?next=/rooms")).toBe("/");
  });
});
