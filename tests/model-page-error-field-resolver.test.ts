import { describe, expect, it } from "vitest";

import { ClientRequestError, type ClientErrorFeedback } from "@/lib/client/chat-lab-client";
import {
  resolveConnectionFieldErrors,
  resolveModelFieldErrors,
} from "@/components/models-page/error-field-resolver";

const genericFeedback: ClientErrorFeedback = {
  title: "操作没有完成",
  description: "请求失败。",
  suggestion: "请稍后重试。",
  tone: "error",
};

describe("resolveModelFieldErrors", () => {
  it("prefers structured field hints for connection-mode errors", () => {
    const fieldErrors = resolveModelFieldErrors(
      new ClientRequestError("Provider connection connection-1 was not found.", 404, {
        reasonCode: "provider_connection_not_found",
        fieldHints: ["connectionId"],
      }),
      genericFeedback,
      "submit",
    );

    expect(fieldErrors.connectionId).toContain("已保存连接");
  });

  it("maps structured provider and baseUrl hints to the builder controls", () => {
    const fieldErrors = resolveModelFieldErrors(
      new ClientRequestError("Unsupported provider: CLAUDE", 400, {
        reasonCode: "unsupported_provider",
        fieldHints: ["providerTemplate", "baseUrl"],
      }),
      genericFeedback,
      "submit",
    );

    expect(fieldErrors.providerTemplate).toContain("厂商模板");
    expect(fieldErrors.baseUrl).toContain("Base URL");
  });

  it("falls back to feedback heuristics when no structured hints are available", () => {
    const fieldErrors = resolveModelFieldErrors(
      new Error("401 invalid_api_key"),
      {
        title: "API Key 无效或鉴权失败",
        description: "当前 API Key 没有通过验证。",
        suggestion: "请检查 API Key。",
        tone: "error",
      },
      "submit",
    );

    expect(fieldErrors.apiKey).toContain("API Key");
  });
});

describe("resolveConnectionFieldErrors", () => {
  it("maps probe-model requirements to the probe model field", () => {
    const fieldErrors = resolveConnectionFieldErrors(
      new ClientRequestError("Provider GEMINI requires a model ID to test the connection.", 400, {
        reasonCode: "provider_connection_probe_model_required",
        fieldHints: ["modelName", "providerTemplate"],
      }),
      genericFeedback,
    );

    expect(fieldErrors.probeModelName).toContain("测试模型 ID");
    expect(fieldErrors.providerTemplate).toContain("厂商模板");
  });

  it("maps manual-only discovery hints back to the provider template selector", () => {
    const fieldErrors = resolveConnectionFieldErrors(
      new ClientRequestError("Provider connection Google Workspace is configured for manual model entry only.", 400, {
        reasonCode: "provider_connection_manual_only",
        fieldHints: ["discoveryStrategy", "modelName"],
      }),
      genericFeedback,
    );

    expect(fieldErrors.providerTemplate).toContain("模板");
    expect(fieldErrors.probeModelName).toContain("测试模型 ID");
  });
});
