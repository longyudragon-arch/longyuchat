import { describe, expect, it } from "vitest";

import {
  APP_SESSION_COOKIE_NAME,
  createAppSessionToken,
  getAccessProtectionMode,
  isAppLoginEnabled,
  isAppSessionAuthorized,
  resolveSafeNextPath,
} from "@/lib/app-auth";

describe("app auth helpers", () => {
  it("detects app login when credentials and session secret are configured", () => {
    expect(
      isAppLoginEnabled({
        username: "longyu",
        password: "secret",
        sessionSecret: "session-secret",
      }),
    ).toBe(true);
  });

  it("creates a stable session token and validates it", async () => {
    const input = {
      username: "longyu",
      password: "secret",
      sessionSecret: "session-secret",
    };

    const token = await createAppSessionToken(input);

    expect(token.length).toBeGreaterThan(20);
    expect(await isAppSessionAuthorized(token, input)).toBe(true);
    expect(await isAppSessionAuthorized(`${token}-wrong`, input)).toBe(false);
  });

  it("prefers app login over basic auth when both are configured", () => {
    expect(
      getAccessProtectionMode({
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
