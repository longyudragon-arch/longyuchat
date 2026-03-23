import { describe, expect, it } from "vitest";

import {
  countAssistantRepliesForUserMessage,
  ClientRequestError,
  describeClientError,
  describePartialSendResult,
  findNextUserMessageAfterSequence,
  getUserMessageRoundStatus,
  supportsAutomaticModelDiscovery,
} from "@/lib/client/chat-lab-client";
import type { MessageView } from "@/types/app";

describe("describeClientError", () => {
  it("returns API key guidance for authentication failures", () => {
    const feedback = describeClientError(new ClientRequestError("401 invalid_api_key", 401));

    expect(feedback.title).toBe("API Key 无效或鉴权失败");
    expect(feedback.suggestion).toContain("API Key");
    expect(feedback.tone).toBe("error");
  });

  it("returns login guidance for app-level access protection", () => {
    const feedback = describeClientError(new ClientRequestError("Login required.", 401));

    expect(feedback.title).toBe("需要先登录");
    expect(feedback.tone).toBe("warning");
  });

  it("returns network guidance for timeout-like failures", () => {
    const feedback = describeClientError(new Error("Provider timeout"));

    expect(feedback.title).toBe("模型请求超时或网络连接失败");
    expect(feedback.suggestion).toContain("Base URL");
  });

  it("returns disabled-model guidance for disabled room models", () => {
    const feedback = describeClientError(new Error("Model Alpha is disabled."));

    expect(feedback.title).toBe("房间里存在已停用的模型");
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
  it("keeps OpenAI-compatible discovery enabled and leaves the new providers manual for now", () => {
    expect(supportsAutomaticModelDiscovery("OPENAI_COMPATIBLE")).toBe(true);
    expect(supportsAutomaticModelDiscovery("DOUBAO")).toBe(true);
    expect(supportsAutomaticModelDiscovery("MODELSCOPE")).toBe(true);
    expect(supportsAutomaticModelDiscovery("HUNYUAN")).toBe(false);
    expect(supportsAutomaticModelDiscovery("QWEN")).toBe(false);
    expect(supportsAutomaticModelDiscovery("CLAUDE")).toBe(false);
  });
});

describe("message round helpers", () => {
  const messages: MessageView[] = [
    {
      id: "user-1",
      roomId: "room-1",
      sequence: 1,
      role: "USER",
      modelId: null,
      model: null,
      content: "Hello",
      createdAt: "2026-03-23T10:00:00.000Z",
    },
    {
      id: "assistant-1",
      roomId: "room-1",
      sequence: 2,
      role: "ASSISTANT",
      modelId: "model-a",
      model: null,
      content: "Reply A",
      createdAt: "2026-03-23T10:00:01.000Z",
    },
    {
      id: "user-2",
      roomId: "room-1",
      sequence: 3,
      role: "USER",
      modelId: null,
      model: null,
      content: "Next",
      createdAt: "2026-03-23T10:00:02.000Z",
    },
    {
      id: "assistant-2",
      roomId: "room-1",
      sequence: 4,
      role: "ASSISTANT",
      modelId: "model-a",
      model: null,
      content: "Reply B",
      createdAt: "2026-03-23T10:00:03.000Z",
    },
  ];

  it("finds the next persisted user message after a baseline sequence", () => {
    expect(findNextUserMessageAfterSequence(messages, 1)?.id).toBe("user-2");
    expect(findNextUserMessageAfterSequence(messages, 3)).toBeNull();
  });

  it("counts only the assistant replies in the current user round", () => {
    expect(countAssistantRepliesForUserMessage(messages, 1)).toBe(1);
    expect(countAssistantRepliesForUserMessage(messages, 3)).toBe(1);
  });

  it("distinguishes between awaiting, in-progress, partial, and completed rounds", () => {
    expect(
      getUserMessageRoundStatus({
        message: messages[2],
        messages: [messages[0], messages[2]],
        expectedAssistantCount: 2,
        pendingRoundUserSequence: 3,
        sendInProgress: true,
      }),
    ).toBe("awaiting");

    expect(
      getUserMessageRoundStatus({
        message: messages[2],
        messages,
        expectedAssistantCount: 2,
        pendingRoundUserSequence: 3,
        sendInProgress: true,
      }),
    ).toBe("in-progress");

    expect(
      getUserMessageRoundStatus({
        message: messages[2],
        messages,
        expectedAssistantCount: 2,
        pendingRoundUserSequence: null,
        sendInProgress: false,
      }),
    ).toBe("partial");

    expect(
      getUserMessageRoundStatus({
        message: messages[2],
        messages: [
          ...messages,
          {
            id: "assistant-3",
            roomId: "room-1",
            sequence: 5,
            role: "ASSISTANT",
            modelId: "model-b",
            model: null,
            content: "Reply C",
            createdAt: "2026-03-23T10:00:04.000Z",
          },
        ],
        expectedAssistantCount: 2,
        pendingRoundUserSequence: 3,
        sendInProgress: true,
      }),
    ).toBe("completed");
  });
});
