import { describe, expect, it } from "vitest";

import {
  isBasicAuthAuthorized,
  isHealthcheckBearerAuthorized,
  isPublicAccessPath,
  isServerAccessProtectionEnabled,
  parseBasicAuthHeader,
} from "@/lib/server-access";

describe("isServerAccessProtectionEnabled", () => {
  it("enables access protection when explicit flag is true", () => {
    expect(isServerAccessProtectionEnabled({ enabled: "true" })).toBe(true);
  });

  it("falls back to username and password when explicit flag is absent", () => {
    expect(isServerAccessProtectionEnabled({ username: "demo", password: "secret" })).toBe(true);
  });

  it("stays disabled without explicit flag or credentials", () => {
    expect(isServerAccessProtectionEnabled({})).toBe(false);
  });
});

describe("parseBasicAuthHeader", () => {
  it("extracts username and password from a valid basic header", () => {
    const header = `Basic ${Buffer.from("demo:secret").toString("base64")}`;
    expect(parseBasicAuthHeader(header)).toEqual({
      username: "demo",
      password: "secret",
    });
  });

  it("returns null for invalid headers", () => {
    expect(parseBasicAuthHeader("Bearer token")).toBeNull();
    expect(parseBasicAuthHeader(null)).toBeNull();
  });
});

describe("isBasicAuthAuthorized", () => {
  it("accepts correct credentials and rejects incorrect ones", () => {
    const validHeader = `Basic ${Buffer.from("demo:secret").toString("base64")}`;
    const invalidHeader = `Basic ${Buffer.from("demo:wrong").toString("base64")}`;

    expect(isBasicAuthAuthorized(validHeader, "demo", "secret")).toBe(true);
    expect(isBasicAuthAuthorized(invalidHeader, "demo", "secret")).toBe(false);
  });
});

describe("isHealthcheckBearerAuthorized", () => {
  it("accepts the configured bearer token", () => {
    expect(isHealthcheckBearerAuthorized("Bearer health-token", "health-token")).toBe(true);
  });

  it("rejects missing or incorrect bearer tokens", () => {
    expect(isHealthcheckBearerAuthorized("Bearer wrong-token", "health-token")).toBe(false);
    expect(isHealthcheckBearerAuthorized(null, "health-token")).toBe(false);
  });
});

describe("isPublicAccessPath", () => {
  it("keeps Next static assets public", () => {
    expect(isPublicAccessPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isPublicAccessPath("/favicon.ico")).toBe(true);
  });

  it("still protects application routes", () => {
    expect(isPublicAccessPath("/models")).toBe(false);
    expect(isPublicAccessPath("/api/models")).toBe(false);
  });
});
