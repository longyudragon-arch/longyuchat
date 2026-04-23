import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_SESSION_COOKIE_NAME,
  createAppSessionToken,
  isAppSessionAuthorized,
  resetAppSessionRevocations,
} from "@/lib/app-auth";

const originalEnv = {
  APP_LOGIN_ENABLED: process.env.APP_LOGIN_ENABLED,
  APP_LOGIN_USERNAME: process.env.APP_LOGIN_USERNAME,
  APP_LOGIN_PASSWORD: process.env.APP_LOGIN_PASSWORD,
  APP_LOGIN_SESSION_SECRET: process.env.APP_LOGIN_SESSION_SECRET,
};

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    process.env.APP_LOGIN_ENABLED = "true";
    process.env.APP_LOGIN_USERNAME = "longyu";
    process.env.APP_LOGIN_PASSWORD = "secret";
    process.env.APP_LOGIN_SESSION_SECRET = "session-secret";
    resetAppSessionRevocations();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    resetAppSessionRevocations();
    vi.resetModules();
  });

  it("revokes the active app-session token before clearing the cookie", async () => {
    const token = await createAppSessionToken();
    const { POST } = await import("@/app/api/auth/logout/route");

    expect(await isAppSessionAuthorized(token)).toBe(true);

    const response = await POST(
      new Request("https://example.com/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: `${APP_SESSION_COOKIE_NAME}=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    expect(await isAppSessionAuthorized(token)).toBe(false);
  });
});
