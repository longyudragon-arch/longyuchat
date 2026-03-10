import { describe, expect, it } from "vitest";

import {
  ClientRequestError,
  describeClientError,
  describePartialSendResult,
  supportsAutomaticModelDiscovery,
} from "@/lib/client/chat-lab-client";

describe("describeClientError", () => {
  it("returns API key guidance for authentication failures", () => {
    const feedback = describeClientError(new ClientRequestError("401 invalid_api_key", 401));

    expect(feedback.title).toBe("API Key 无效或鉴权失败");
    expect(feedback.suggestion).toContain("API Key");
    expect(feedback.tone).toBe("error");
  });

  it("returns network guidance for timeout-like failures", () => {
    const feedback = describeClientError(new Error("Provider timeout"));

    expect(feedback.title).toBe("模型请求超时或网络连接失败");
    expect(feedback.suggestion).toContain("Base URL");
  });

  it("returns disabled-model guidance for disabled room models", () => {
    const feedback = describeClientError(new Error("Model Alpha is disabled."));

    expect(feedback.title).toBe("房间里有已停用的模型");
    expect(feedback.tone).toBe("warning");
  });
});

describe("describePartialSendResult", () => {
  it("turns a partial result into a warning feedback block", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        failedModelId: "model-b",
        error: "Provider timeout",
      },
      "Mock Beta",
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 未完成本轮回复",
      tone: "warning",
    });
    expect(feedback?.suggestion).toContain("Base URL");
  });
});

describe("supportsAutomaticModelDiscovery", () => {
  it("enables discovery for compatible providers and keeps Claude manual", () => {
    expect(supportsAutomaticModelDiscovery("OPENAI_COMPATIBLE")).toBe(true);
    expect(supportsAutomaticModelDiscovery("DOUBAO")).toBe(true);
    expect(supportsAutomaticModelDiscovery("MODELSCOPE")).toBe(true);
    expect(supportsAutomaticModelDiscovery("CLAUDE")).toBe(false);
  });
});
