import { describe, expect, it } from "vitest";

import {
  areApiRateLimitsEnabled,
  areDevMocksEnabledForClient,
  areDevMocksEnabledForServer,
  getAppLogDir,
  getApiRateLimitMaxMessagePosts,
  getApiRateLimitMaxLoginAttempts,
  getApiRateLimitMaxModelDiscovery,
  getApiRateLimitMaxModelTests,
  getApiRateLimitWindowSeconds,
  getConversationHistoryContextTokenBudget,
  getConversationHistoryWindowBeforeLatestUserMessages,
  getBigModelRequestTimeoutMs,
  getProviderRequestTimeoutMs,
  getRoomModelCooldownSeconds,
  getRoomModelNetworkCooldownSeconds,
  getSqliteBackupDir,
  getSqliteBackupRetentionDays,
  isFileLoggingEnabled,
  isReplyRewritePassEnabled,
  isUnprotectedAccessAllowedInProduction,
  shouldRetryReasoningOnlyResponses,
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
    expect(getApiRateLimitMaxLoginAttempts(undefined)).toBe(5);
    expect(getApiRateLimitMaxModelTests(undefined)).toBe(10);
    expect(getApiRateLimitMaxModelDiscovery(undefined)).toBe(20);
  });

  it("accepts positive integer overrides", () => {
    expect(getApiRateLimitWindowSeconds("120")).toBe(120);
    expect(getApiRateLimitMaxMessagePosts("5")).toBe(5);
    expect(getApiRateLimitMaxLoginAttempts("3")).toBe(3);
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
    expect(getAppLogDir("production", "/srv/longyuchat/logs")).toBe("/srv/longyuchat/logs");
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

describe("provider timeout and adapter retry flags", () => {
  it("returns stable timeout defaults and honors overrides", () => {
    expect(getProviderRequestTimeoutMs(undefined)).toBe(120_000);
    expect(getProviderRequestTimeoutMs("90000")).toBe(90_000);
    expect(getProviderRequestTimeoutMs("invalid")).toBe(120_000);

    expect(getBigModelRequestTimeoutMs(undefined)).toBe(150_000);
    expect(getBigModelRequestTimeoutMs("150000")).toBe(150_000);
    expect(getBigModelRequestTimeoutMs("invalid")).toBe(150_000);
  });

  it("parses rewrite and reasoning retry feature flags", () => {
    expect(isReplyRewritePassEnabled(undefined)).toBe(false);
    expect(isReplyRewritePassEnabled("true")).toBe(true);
    expect(shouldRetryReasoningOnlyResponses(undefined)).toBe(true);
    expect(shouldRetryReasoningOnlyResponses("false")).toBe(false);
  });
});

describe("conversation context window runtime helper", () => {
  it("returns a stable default and honors valid overrides", () => {
    expect(getConversationHistoryWindowBeforeLatestUserMessages(undefined)).toBe(8);
    expect(getConversationHistoryWindowBeforeLatestUserMessages("6")).toBe(6);
    expect(getConversationHistoryWindowBeforeLatestUserMessages("invalid")).toBe(8);
    expect(getConversationHistoryContextTokenBudget(undefined)).toBe(2400);
    expect(getConversationHistoryContextTokenBudget("1800")).toBe(1800);
    expect(getConversationHistoryContextTokenBudget("invalid")).toBe(2400);
  });
});

describe("room model cooldown runtime helpers", () => {
  it("returns stable defaults and honors valid overrides", () => {
    expect(getRoomModelCooldownSeconds(undefined)).toBe(600);
    expect(getRoomModelCooldownSeconds("420")).toBe(420);
    expect(getRoomModelCooldownSeconds("invalid")).toBe(600);

    expect(getRoomModelNetworkCooldownSeconds(undefined)).toBe(900);
    expect(getRoomModelNetworkCooldownSeconds("1200")).toBe(1200);
    expect(getRoomModelNetworkCooldownSeconds("invalid")).toBe(900);
  });
});
