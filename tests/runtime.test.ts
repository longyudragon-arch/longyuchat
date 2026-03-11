import { describe, expect, it } from "vitest";

import {
  areApiRateLimitsEnabled,
  areDevMocksEnabledForClient,
  areDevMocksEnabledForServer,
  getAppLogDir,
  getApiRateLimitMaxMessagePosts,
  getApiRateLimitMaxModelDiscovery,
  getApiRateLimitMaxModelTests,
  getApiRateLimitWindowSeconds,
  getSqliteBackupDir,
  getSqliteBackupRetentionDays,
  isFileLoggingEnabled,
  isUnprotectedAccessAllowedInProduction,
} from "@/lib/runtime";

describe("areDevMocksEnabledForServer", () => {
  it("defaults to enabled outside production", () => {
    expect(areDevMocksEnabledForServer("development", undefined)).toBe(true);
  });

  it("defaults to disabled in production", () => {
    expect(areDevMocksEnabledForServer("production", undefined)).toBe(false);
  });

  it("accepts explicit truthy and falsy overrides", () => {
    expect(areDevMocksEnabledForServer("production", "true")).toBe(true);
    expect(areDevMocksEnabledForServer("development", "false")).toBe(false);
  });
});

describe("areDevMocksEnabledForClient", () => {
  it("mirrors production-safe defaults for the browser", () => {
    expect(areDevMocksEnabledForClient("production", undefined)).toBe(false);
    expect(areDevMocksEnabledForClient("development", undefined)).toBe(true);
  });

  it("supports public overrides for preview deployments", () => {
    expect(areDevMocksEnabledForClient("production", "true")).toBe(true);
    expect(areDevMocksEnabledForClient("development", "false")).toBe(false);
  });
});

describe("areApiRateLimitsEnabled", () => {
  it("defaults to enabled in production only", () => {
    expect(areApiRateLimitsEnabled("production", undefined)).toBe(true);
    expect(areApiRateLimitsEnabled("development", undefined)).toBe(false);
  });

  it("honors explicit opt-in and opt-out", () => {
    expect(areApiRateLimitsEnabled("development", "true")).toBe(true);
    expect(areApiRateLimitsEnabled("production", "false")).toBe(false);
  });
});

describe("API rate limit env helpers", () => {
  it("falls back to safe defaults when unset or invalid", () => {
    expect(getApiRateLimitWindowSeconds(undefined)).toBe(60);
    expect(getApiRateLimitWindowSeconds("0")).toBe(60);
    expect(getApiRateLimitMaxMessagePosts("nope")).toBe(12);
    expect(getApiRateLimitMaxModelTests(undefined)).toBe(10);
    expect(getApiRateLimitMaxModelDiscovery(undefined)).toBe(20);
  });

  it("accepts positive integer overrides", () => {
    expect(getApiRateLimitWindowSeconds("120")).toBe(120);
    expect(getApiRateLimitMaxMessagePosts("5")).toBe(5);
    expect(getApiRateLimitMaxModelTests("7")).toBe(7);
    expect(getApiRateLimitMaxModelDiscovery("9")).toBe(9);
  });
});

describe("file logging runtime helpers", () => {
  it("defaults to enabled in production with a stable default directory", () => {
    expect(isFileLoggingEnabled("production", undefined)).toBe(true);
    expect(getAppLogDir("production", undefined)).toContain("var");
  });

  it("supports explicit overrides", () => {
    expect(isFileLoggingEnabled("production", "false")).toBe(false);
    expect(getAppLogDir("production", "/srv/ai-chat-lab/logs")).toBe("/srv/ai-chat-lab/logs");
  });
});

describe("sqlite backup runtime helpers", () => {
  it("returns production defaults and accepts retention overrides", () => {
    expect(getSqliteBackupDir("production", undefined)).toContain("sqlite");
    expect(getSqliteBackupRetentionDays(undefined)).toBe(7);
    expect(getSqliteBackupRetentionDays("14")).toBe(14);
  });
});

describe("production access escape hatch", () => {
  it("stays disabled by default and accepts explicit opt-in", () => {
    expect(isUnprotectedAccessAllowedInProduction(undefined)).toBe(false);
    expect(isUnprotectedAccessAllowedInProduction("true")).toBe(true);
  });
});
