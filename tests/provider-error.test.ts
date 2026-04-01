import { describe, expect, it } from "vitest";

import {
  createProviderApiError,
  createProviderResponseApiError,
  formatProviderError,
  inferProviderErrorKind,
  inferProviderErrorKindFromMessage,
  shouldPauseModelOnProviderErrorKind,
} from "@/server/http/provider-error";

const geminiInvalidKeyBody = JSON.stringify([
  {
    error: {
      code: 400,
      message: "API Key not found. Please pass a valid API key.",
      status: "INVALID_ARGUMENT",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.ErrorInfo",
          reason: "API_KEY_INVALID",
          domain: "googleapis.com",
        },
      ],
    },
  },
]);

describe("provider-error helpers", () => {
  it("classifies Gemini invalid key responses as authentication failures", () => {
    expect(inferProviderErrorKind(400, geminiInvalidKeyBody)).toBe("authentication");
    expect(formatProviderError(400, geminiInvalidKeyBody)).toMatch(/Provider authentication failed with 400:/);
  });

  it("keeps provider metadata in ApiError details", () => {
    const error = createProviderApiError({
      status: 400,
      bodyText: geminiInvalidKeyBody,
      provider: "GEMINI",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    });

    expect(error.status).toBe(400);
    expect(error.message).toMatch(/Provider authentication failed with 400:/);
    expect(error.details).toMatchObject({
      provider: "GEMINI",
      providerErrorKind: "authentication",
      upstreamStatus: 400,
      reasonCode: "provider_authentication_failed",
      retryable: false,
      fieldHints: ["apiKey", "baseUrl", "providerTemplate"],
    });
  });

  it("adds structured retry and field-hint metadata for timeout-like provider failures", () => {
    const error = createProviderApiError({
      status: 504,
      bodyText: JSON.stringify({
        error: {
          message: "Upstream request timed out before the provider responded.",
        },
      }),
      provider: "OPENAI_COMPATIBLE",
      endpoint: "https://api.example.com/v1/chat/completions",
    });

    expect(error.details).toMatchObject({
      providerErrorKind: "network",
      reasonCode: "provider_timeout",
      retryable: true,
      fieldHints: ["baseUrl", "network", "providerStatus"],
    });
  });

  it("adds structured reason codes for unusable provider responses", () => {
    const error = createProviderResponseApiError({
      provider: "OPENAI_COMPATIBLE",
      endpoint: "https://api.example.com/v1/chat/completions",
      kind: "reasoning_only",
      finishReason: "stop",
      attemptCount: 2,
      contentLength: 0,
      reasoningLength: 128,
      completionTokens: 0,
    });

    expect(error.status).toBe(502);
    expect(error.details).toMatchObject({
      providerErrorKind: "reasoning_only",
      reasonCode: "provider_reasoning_only",
      retryable: true,
      fieldHints: ["modelName", "providerCompatibility", "inputPrompt"],
      finishReason: "stop",
      attemptCount: 2,
    });
  });

  it("can infer the provider error kind back from a partial-send error message", () => {
    expect(
      inferProviderErrorKindFromMessage(
        "Provider authentication failed with 400: API Key not found. Please pass a valid API key.",
      ),
    ).toBe("authentication");
  });

  it("does not treat generic API key references as durable authentication failures", () => {
    const body = JSON.stringify({
      error: {
        message: "The request is invalid. Refer to the API key rotation guide for setup instructions.",
      },
    });

    expect(inferProviderErrorKind(400, body)).toBe("request");
  });

  it("only auto-pauses durable provider error kinds", () => {
    expect(shouldPauseModelOnProviderErrorKind("authentication")).toBe(true);
    expect(shouldPauseModelOnProviderErrorKind("quota")).toBe(true);
    expect(shouldPauseModelOnProviderErrorKind("not_found")).toBe(true);
    expect(shouldPauseModelOnProviderErrorKind("empty_response")).toBe(false);
    expect(shouldPauseModelOnProviderErrorKind("reasoning_only")).toBe(false);
  });
});
