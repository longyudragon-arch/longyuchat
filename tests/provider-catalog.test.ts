import { afterEach, describe, expect, it } from "vitest";

import {
  getDirectCreateProviderOptions,
  getProviderCapabilities,
  getProviderExecutionProfile,
  supportsProviderAdapter,
} from "@/lib/provider-catalog";

describe("getProviderExecutionProfile", () => {
  afterEach(() => {
    delete process.env.PROVIDER_REQUEST_TIMEOUT_MS;
    delete process.env.BIGMODEL_REQUEST_TIMEOUT_MS;
    delete process.env.ENABLE_REPLY_REWRITE_PASS;
    delete process.env.ENABLE_REASONING_ONLY_RESPONSE_RETRY;
  });

  it("returns the standard openai-compatible defaults when no provider-specific override matches", () => {
    const profile = getProviderExecutionProfile({
      provider: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.openai.com/v1",
    });

    expect(profile).toEqual({
      matchedTemplateId: null,
      requestTimeoutMs: 120_000,
      allowsReasoningOnlyRetry: true,
      allowsReplyRewritePass: false,
      supportsAutomaticDiscovery: true,
      endpointCompatibility: "STANDARD_OPENAI",
    });
  });

  it("uses the BigModel override when the configured base url matches the template", () => {
    process.env.PROVIDER_REQUEST_TIMEOUT_MS = "90000";
    process.env.BIGMODEL_REQUEST_TIMEOUT_MS = "180000";
    process.env.ENABLE_REPLY_REWRITE_PASS = "true";
    process.env.ENABLE_REASONING_ONLY_RESPONSE_RETRY = "false";

    const profile = getProviderExecutionProfile({
      provider: "OPENAI_COMPATIBLE",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4/",
    });

    expect(profile).toEqual({
      matchedTemplateId: "zhipu-bigmodel",
      requestTimeoutMs: 180_000,
      allowsReasoningOnlyRetry: false,
      allowsReplyRewritePass: true,
      supportsAutomaticDiscovery: true,
      endpointCompatibility: "BIGMODEL_V4",
    });
  });

  it("falls back safely when the provider type is not part of the MVP set", () => {
    const profile = getProviderExecutionProfile({
      provider: "CUSTOM_PROVIDER",
      baseUrl: "https://example.com/v1",
    });

    expect(profile).toEqual({
      matchedTemplateId: null,
      requestTimeoutMs: 120_000,
      allowsReasoningOnlyRetry: true,
      allowsReplyRewritePass: false,
      supportsAutomaticDiscovery: false,
      endpointCompatibility: "STANDARD_OPENAI",
    });
  });
});

describe("provider capability registry", () => {
  it("drives the direct-create provider list from a single capability source", () => {
    expect(getDirectCreateProviderOptions()).toEqual([
      "OPENAI_COMPATIBLE",
      "GEMINI",
      "GROK",
    ]);
  });

  it("exposes adapter compatibility from the provider capability registry", () => {
    expect(supportsProviderAdapter("GEMINI", "OPENAI_COMPATIBLE")).toBe(true);
    expect(supportsProviderAdapter("CLAUDE", "OPENAI_COMPATIBLE")).toBe(false);
  });

  it("returns provider capabilities that stay aligned with discovery behavior", () => {
    expect(getProviderCapabilities("QWEN")).toMatchObject({
      adapterKind: "OPENAI_COMPATIBLE",
      supportsAutomaticDiscovery: true,
      supportsDirectCreate: false,
    });
  });
});
