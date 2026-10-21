import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countAssistantRepliesForUserMessage,
  createProviderConnectionRequest,
  ClientRequestError,
  deleteProviderConnectionRequest,
  describeClientError,
  describeInterruptedSendRecovery,
  describePartialSendResult,
  describeSkippedModelsResult,
  discoverProviderModelsByConnectionRequest,
  discoverProviderModelsBySavedModelRequest,
  findMatchingProviderTemplate,
    fetchProviderCatalogRequest,
    fetchProviderConnectionByIdRequest,
    fetchProviderConnectionsRequest,
    getDefaultDiscoveryStrategy,
    getProviderTemplateById,
    findNextUserMessageAfterSequence,

  getUserMessageRoundStatus,
  providerConnectionTemplates,
  supportsAutomaticModelDiscovery,
  testProviderConnectionRequest,
  updateProviderConnectionRequest,
  fetchJson,
} from "@/lib/client/longyuchat-client";
import type { MessageView, ProviderConnectionView } from "@/types/app";

const exampleConnection: ProviderConnectionView = {
  id: "connection-1",
  name: "Google Workspace",
  provider: "GEMINI",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  discoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
  enabled: true,
  createdAt: "2026-03-25T10:00:00.000Z",
  updatedAt: "2026-03-25T10:00:00.000Z",
  hasApiKey: true,
  modelCount: 2,
  supportsAutomaticModelDiscovery: true,
  lastAuthCheck: null,
  lastDiscoveryCheck: null,
};

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

describe("describeClientError", () => {
  it("returns API key guidance for authentication failures", () => {
    const feedback = describeClientError(new ClientRequestError("401 invalid_api_key", 401));

    expect(feedback.title).toBe("API Key 无效或鉴权失败");
    expect(feedback.suggestion).toContain("API Key");
    expect(feedback.tone).toBe("error");
  });

  it("prefers structured provider auth details over brittle message wording", () => {
    const feedback = describeClientError(
      new ClientRequestError("Request failed.", 400, {
        providerErrorKind: "authentication",
        upstreamStatus: 401,
        endpoint: "https://api.example.com/v1/chat/completions",
      }),
    );

    expect(feedback.title).toBe("API Key 无效或鉴权失败");
    expect(feedback.suggestion).toContain("API Key");
  });

  it("prefers structured provider not-found details over generic 404 copy", () => {
    const feedback = describeClientError(
      new ClientRequestError("The requested record was not found.", 404, {
        providerErrorKind: "not_found",
        upstreamStatus: 404,
        endpoint: "https://api.example.com/v1/models",
      }),
    );

    expect(feedback.title).toBe("模型 ID、端点或上游资源不存在");
    expect(feedback.suggestion).toContain("Provider 模板");
  });

  it("prefers structured network details when the message text is generic", () => {
    const feedback = describeClientError(
      new ClientRequestError("Request failed.", 502, {
        providerErrorKind: "network",
        upstreamStatus: 504,
        reasonCode: "provider_timeout",
      }),
    );

    expect(feedback.title).toBe("模型请求超时或网络连接失败");
    expect(feedback.suggestion).toContain("Base URL");
  });

  it("does not misclassify provider API key errors as deleted resources", () => {
    const feedback = describeClientError(
      new Error("Provider authentication failed with 400: API Key not found. Please pass a valid API key."),
    );

    expect(feedback.title).toBe("API Key 无效或鉴权失败");
    expect(feedback.suggestion).toContain("API Key");
    expect(feedback.suggestion).not.toContain("它可能已经被删除");
  });

  it("does not treat generic api key wording as an auth failure without a specific signal", () => {
    const feedback = describeClientError(
      new Error("Please review the API key format requirements in the provider documentation."),
    );

    expect(feedback.title).not.toBe("API Key 无效或鉴权失败");
    expect(feedback.title).toBe("操作没有完成");
  });

  it("returns login guidance for app-level access protection", () => {
    const feedback = describeClientError(new ClientRequestError("Login required.", 401));

    expect(feedback.title).toBe("需要先登录");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured app-login reason codes for disabled login", () => {
    const feedback = describeClientError(
      new ClientRequestError("App login is not enabled on this server.", 503, {
        reasonCode: "app_login_disabled",
        retryable: false,
      }),
    );

    expect(feedback.title).toBe("当前站点未开启登录");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured app-login reason codes for invalid credentials", () => {
    const feedback = describeClientError(
      new ClientRequestError("Invalid username or password.", 401, {
        reasonCode: "invalid_credentials",
        retryable: true,
        fieldHints: ["username", "password"],
      }),
    );

    expect(feedback.title).toBe("用户名或密码不正确");
    expect(feedback.suggestion).toContain("用户名");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured request validation reason codes before generic message guesses", () => {
    const feedback = describeClientError(
      new ClientRequestError("Invalid request payload.", 400, {
        reasonCode: "invalid_request_payload",
        fieldHints: ["provider", "baseUrl", "apiKey"],
      }),
    );

    expect(feedback.title).toBe("请求参数不完整或格式不正确");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured duplicate-record reason codes for unique conflicts", () => {
    const feedback = describeClientError(
      new ClientRequestError("The record already exists.", 409, {
        reasonCode: "record_already_exists",
        fieldHints: ["name"],
      }),
    );

    expect(feedback.title).toBe("记录已存在");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured room configuration reason codes before generic wording", () => {
    const feedback = describeClientError(
      new ClientRequestError("Group chat rooms must include at least two models.", 400, {
        reasonCode: "room_group_requires_two_models",
        fieldHints: ["type", "modelIds"],
      }),
    );

    expect(feedback.title).toBe("群聊至少需要 2 个模型");
    expect(feedback.suggestion).toContain("2 个可用模型");
    expect(feedback.tone).toBe("warning");
  });

  it("returns network guidance for timeout-like failures", () => {
    const feedback = describeClientError(new Error("Provider timeout"));

    expect(feedback.title).toBe("模型请求超时");
    expect(feedback.suggestion).toContain("停用这个模型");
  });

  it("returns disabled-model guidance for disabled room models", () => {
    const feedback = describeClientError(new Error("Model Alpha is disabled."));

    expect(feedback.title).toBe("房间里存在已停用的模型");
    expect(feedback.tone).toBe("warning");
  });

  it("returns provider-template guidance for unsupported native provider protocols", () => {
    const feedback = describeClientError(new Error("Provider CLAUDE is not supported in the MVP yet."));

    expect(feedback.title).toBe("当前 Provider 模板暂未接入");
    expect(feedback.description).toContain("Claude 原生接口");
    expect(feedback.suggestion).toContain("Provider 模板");
    expect(feedback.tone).toBe("warning");
  });

  it("returns cooldown guidance when a room has no runnable models left", () => {
    const feedback = describeClientError(
      new Error("Room room-1 does not currently have any runnable models. All models are disabled or cooling down."),
    );

    expect(feedback.title).toBe("当前房间暂时没有可运行的模型");
    expect(feedback.suggestion).toContain("冷却结束");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured room in-flight reason codes for room-send conflicts", () => {
    const feedback = describeClientError(
      new ClientRequestError("Room room-1 is already processing another message. Please wait for the current round to finish.", 409, {
        reasonCode: "room_message_in_flight",
        retryable: true,
        roomId: "room-1",
      }),
    );

    expect(feedback.title).toBe("当前房间正在回复中");
    expect(feedback.suggestion).toContain("顺序回复");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured manual-only reason codes for provider discovery guidance", () => {
    const feedback = describeClientError(
      new ClientRequestError("Provider connection Google Workspace is configured for manual model entry only.", 400, {
        reasonCode: "provider_connection_manual_only",
        connectionId: "connection-1",
        connectionName: "Google Workspace",
        discoveryStrategy: "MANUAL_ONLY",
      }),
    );

    expect(feedback.title).toBe("该连接配置为手动录入模式");
    expect(feedback.suggestion).toContain("模型 ID");
    expect(feedback.tone).toBe("warning");
  });

  it("uses structured source-mode reason codes for linked models", () => {
    const feedback = describeClientError(
      new ClientRequestError(
        "Model Gemini 主模型 is linked to a provider connection. Please update the connection or switch the model to another connection first.",
        400,
        {
          reasonCode: "model_linked_to_connection",
          modelId: "model-1",
          modelName: "Gemini 主模型",
          connectionId: "connection-1",
        },
      ),
    );

    expect(feedback.title).toBe("当前模型由已保存连接托管");
    expect(feedback.suggestion).toContain("直接配置");
    expect(feedback.tone).toBe("warning");
  });

  it("returns room-reference guidance when deleting a model still used by chat rooms", () => {
    const feedback = describeClientError(
      new ClientRequestError("Model Gemini 主模型 is still used by 2 chat room(s).", 409, {
        modelId: "model-in-use",
        modelName: "Gemini 主模型",
        roomCount: 2,
        rooms: [
          { id: "room-1", title: "新的群聊房间", type: "GROUP" },
          { id: "room-2", title: "身上", type: "SINGLE" },
        ],
      }),
    );

    expect(feedback.title).toBe("模型仍在房间中使用");
    expect(feedback.description).toContain("2 个房间");
    expect(feedback.description).toContain("群聊「新的群聊房间」");
    expect(feedback.description).toContain("单聊「身上」");
    expect(feedback.suggestion).toContain("移除这个模型");
    expect(feedback.tone).toBe("warning");
  });

  it("returns connection-reference guidance when deleting a provider connection still used by models", () => {
    const feedback = describeClientError(
      new ClientRequestError("Provider connection Google Workspace is still used by 2 model(s).", 409, {
        connectionId: "connection-1",
        connectionName: "Google Workspace",
        modelCount: 2,
        models: [
          { id: "model-1", name: "Gemini 2.5 Flash", enabled: true },
          { id: "model-2", name: "Gemini 2.5 Pro", enabled: false },
        ],
      }),
    );

    expect(feedback.title).toBe("连接下仍有模型在使用");
    expect(feedback.description).toContain("Google Workspace");
    expect(feedback.description).toContain("2 个模型");
    expect(feedback.suggestion).toContain("关联模型");
    expect(feedback.tone).toBe("warning");
  });
});

describe("describePartialSendResult", () => {
  it("turns a partial result into a warning feedback block", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        roundOutcomes: [
          {
            modelId: "model-a",
            modelName: "Mock Alpha",
            outcome: "replied",
          },
          {
            modelId: "model-b",
            modelName: "Mock Beta",
            outcome: "failed",
            error: "Provider timeout",
            providerErrorKind: "network",
          },
        ],
        failedModelId: "model-b",
        error: "Provider timeout",
        providerErrorKind: "network",
      },
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 本轮请求超时",
      tone: "warning",
    });
    expect(feedback?.description).toContain("已成功的 1 条回复已保留，本轮后续模型不再执行");
    expect(feedback?.suggestion).toContain("停用它");
  });

  it("surfaces upstream zero-token diagnostics for empty responses", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        roundOutcomes: [
          {
            modelId: "model-b",
            modelName: "Mock Beta",
            outcome: "failed",
            error:
              "The provider returned an empty response without a usable final answer. finish_reason=stop. completion_tokens=0.",
            providerErrorKind: "empty_response",
            providerErrorDetails: {
              finishReason: "stop",
              attemptCount: 2,
              completionTokens: 0,
            },
          },
        ],
        failedModelId: "model-b",
        error: "The provider returned an empty response without a usable final answer. finish_reason=stop. completion_tokens=0.",
        providerErrorKind: "empty_response",
        providerErrorDetails: {
          finishReason: "stop",
          attemptCount: 2,
          completionTokens: 0,
        },
      },
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 未返回可用答案",
      tone: "warning",
    });
    expect(feedback?.description).toContain("completion_tokens=0");
    expect(feedback?.suggestion).toContain("平台侧空响应");
  });

  it("shows quota guidance when the failed model has been auto-paused", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        roundOutcomes: [
          {
            modelId: "model-b",
            modelName: "Mock Beta",
            outcome: "failed",
            error: "Provider quota or billing check failed with 429: token is exhausted.",
            providerErrorKind: "quota",
            paused: true,
            pauseReason:
              "Model Mock Beta was automatically paused after the provider reported quota or token exhaustion.",
          },
        ],
        failedModelId: "model-b",
        error: "Provider quota or billing check failed with 429: token is exhausted.",
        providerErrorKind: "quota",
        failedModelPaused: true,
        failedModelPauseReason:
          "Model Mock Beta was automatically paused after the provider reported quota or token exhaustion.",
      },
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 已自动暂停",
      tone: "warning",
    });
    expect(feedback?.suggestion).toContain("token");
    expect(feedback?.description).toContain("automatically paused");
  });

  it("shows short-input guidance for reasoning-only partial failures", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        roundOutcomes: [
          {
            modelId: "model-b",
            modelName: "Mock Beta",
            outcome: "failed",
            error: "Provider returned reasoning content but no final answer after 2 attempts.",
            providerErrorKind: "reasoning_only",
          },
        ],
        failedModelId: "model-b",
        error: "Provider returned reasoning content but no final answer after 2 attempts.",
        providerErrorKind: "reasoning_only",
      },
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 只返回了推理内容",
      tone: "warning",
    });
    expect(feedback?.suggestion).toContain("超短输入");
  });

  it("surfaces timeout-specific guidance for partial model failures", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        roundOutcomes: [
          {
            modelId: "model-b",
            modelName: "Mock Beta",
            outcome: "failed",
            error:
              "Could not reach https://open.bigmodel.cn/api/paas/v4/chat/completions. Provider request timed out after 120s before the provider responded.",
            providerErrorKind: "network",
            cooldownUntil: "2026-03-30T10:15:00.000Z",
          },
        ],
        failedModelId: "model-b",
        error:
          "Could not reach https://open.bigmodel.cn/api/paas/v4/chat/completions. Provider request timed out after 120s before the provider responded.",
        providerErrorKind: "network",
        failedModelCooldownUntil: "2026-03-30T10:15:00.000Z",
      },
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 本轮请求超时",
      tone: "warning",
    });
    expect(feedback?.suggestion).toContain("停用它");
    expect(feedback?.suggestion).toContain("更快、更稳定的模型");
    expect(feedback?.suggestion).toContain("冷却到");
  });

  it("summarizes persisted legacy mixed rounds without claiming a complete round", () => {
    const feedback = describePartialSendResult({
      roomId: "room-1",
      status: "partial",
      roundOutcomes: [
        {
          modelId: "model-a",
          modelName: "Mock Alpha",
          outcome: "replied",
        },
        {
          modelId: "model-b",
          modelName: "Mock Beta",
          outcome: "failed",
          error: "Provider timeout",
          providerErrorKind: "network",
          cooldownUntil: "2026-03-30T10:15:00.000Z",
        },
        {
          modelId: "model-c",
          modelName: "Mock Gamma",
          outcome: "failed",
          error: "Provider quota exceeded",
          providerErrorKind: "quota",
          paused: true,
          pauseReason: "Model Mock Gamma was automatically paused after quota exhaustion.",
        },
      ],
    });

    expect(feedback).toMatchObject({
      title: "本轮未完整完成，2 个模型失败",
      tone: "warning",
    });
    expect(feedback?.description).toContain("1 个模型的成功回复已保留");
    expect(feedback?.description).toContain("Mock Beta");
    expect(feedback?.description).toContain("Mock Gamma");
    expect(feedback?.suggestion).toContain("自动暂停");
  });

  it("explains unsupported provider failures with template guidance", () => {
    const feedback = describePartialSendResult({
      roomId: "room-1",
      status: "partial",
      roundOutcomes: [
        {
          modelId: "model-a",
          modelName: "谷歌",
          outcome: "failed",
          error: "Provider CLAUDE is not supported in the MVP yet.",
          providerErrorKind: "request",
        },
        {
          modelId: "model-b",
          modelName: "Mock Beta",
          outcome: "replied",
        },
      ],
    });

    expect(feedback).toMatchObject({
      title: "谷歌 当前配置暂未接入",
      tone: "warning",
    });
    expect(feedback?.description).toContain("Claude 原生接口");
    expect(feedback?.description).toContain("已成功的 1 条回复已保留，本轮后续模型不再执行");
    expect(feedback?.suggestion).toContain("Provider 模板");
  });
});

describe("describeSkippedModelsResult", () => {
  it("distinguishes models stopped by an earlier failure from disabled models", () => {
    const feedback = describeSkippedModelsResult({
      roomId: "room-stopped",
      status: "partial",
      roundOutcomes: [{ modelId: "a", modelName: "Alpha", outcome: "failed" }],
      skippedModels: [{ modelId: "b", name: "Beta", reason: "previous_failure", availableAt: null }],
    });

    expect(feedback?.title).toBe("本轮后续模型未执行");
    expect(feedback?.description).toContain("Beta（因前序模型失败未执行）");
    expect(feedback?.description).not.toContain("已停用");
    expect(feedback?.suggestion).toContain("用户消息和已成功的回复均已保存");
  });

  it("tells the user when cooled-down models were skipped so healthy models could continue", () => {
    const feedback = describeSkippedModelsResult({
      roomId: "room-1",
      status: "completed",
      roundOutcomes: [],
      skippedModels: [
        {
          modelId: "model-b",
          name: "Mock Beta",
          reason: "cooldown",
          availableAt: "2026-03-30T10:15:00.000Z",
        },
      ],
    });

    expect(feedback).toMatchObject({
      title: "本轮已跳过冷却中的模型",
      tone: "warning",
    });
    expect(feedback?.description).toContain("Mock Beta");
    expect(feedback?.suggestion).toContain("降级运行");
  });
});



describe("supportsAutomaticModelDiscovery", () => {
  it("keeps only the currently supported provider families discoverable", () => {
    expect(supportsAutomaticModelDiscovery("OPENAI_COMPATIBLE")).toBe(true);
    expect(supportsAutomaticModelDiscovery("DOUBAO")).toBe(true);
    expect(supportsAutomaticModelDiscovery("MODELSCOPE")).toBe(true);
    expect(supportsAutomaticModelDiscovery("HUNYUAN")).toBe(true);
    expect(supportsAutomaticModelDiscovery("QWEN")).toBe(true);
    expect(supportsAutomaticModelDiscovery("CLAUDE")).toBe(false);
  });
});



describe("provider connection templates", () => {
  it("exposes curated domestic and global templates", () => {
    expect(providerConnectionTemplates.some((template) => template.id === "moonshot")).toBe(true);
    expect(providerConnectionTemplates.some((template) => template.id === "openrouter")).toBe(true);
  });

  it("matches saved base URLs back to curated templates", () => {
    const template = findMatchingProviderTemplate("HUNYUAN", "https://api.hunyuan.cloud.tencent.com/v1/");

    expect(template?.id).toBe("hunyuan");
  });

  it("keeps fallback discovery enabled for curated templates with built-in official endpoints", () => {
    expect(getProviderTemplateById("moonshot")?.preferredDiscoveryStrategy).toBe("AUTO_FETCH_WITH_MANUAL_FALLBACK");
    expect(getProviderTemplateById("dashscope")?.preferredDiscoveryStrategy).toBe("AUTO_FETCH_WITH_MANUAL_FALLBACK");
    expect(getProviderTemplateById("github-models")?.preferredDiscoveryStrategy).toBe("AUTO_FETCH_WITH_MANUAL_FALLBACK");
    expect(getDefaultDiscoveryStrategy("OPENAI_COMPATIBLE")).toBe("AUTO_FETCH_WITH_MANUAL_FALLBACK");
    expect(getDefaultDiscoveryStrategy("QWEN")).toBe("AUTO_FETCH_WITH_MANUAL_FALLBACK");
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
      replyDurationMs: null,
      replyTiming: null,
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
      replyDurationMs: null,
      replyTiming: null,
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
      replyDurationMs: null,
      replyTiming: null,
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
      replyDurationMs: null,
      replyTiming: null,
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
      replyDurationMs: null,
      replyTiming: null,
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

describe("describeInterruptedSendRecovery", () => {
  it("explains when the room has already finished syncing replies", () => {
    const feedback = describeInterruptedSendRecovery({
      expectedAssistantCount: 2,
      assistantReplyCount: 2,
    });

    expect(feedback.title).toBe("本轮连接中断，但服务器已完成回复");
    expect(feedback.description).toContain("已经完成当前轮顺序回复");
    expect(feedback.tone).toBe("warning");
  });

  it("explains when the server has continued partially after the request dropped", () => {
    const feedback = describeInterruptedSendRecovery({
      expectedAssistantCount: 4,
      assistantReplyCount: 2,
    });

    expect(feedback.title).toBe("本轮连接中断，但服务器已继续执行");
    expect(feedback.description).toContain("2/4 个模型回复");
    expect(feedback.suggestion).toContain("不要重复发送");
  });

  it("warns against immediate resend when only the user message is known to be persisted", () => {
    const feedback = describeInterruptedSendRecovery({
      expectedAssistantCount: 3,
      assistantReplyCount: 0,
    });

    expect(feedback.title).toBe("消息已提交，服务器可能仍在继续执行");
    expect(feedback.suggestion).toContain("不要立即重发");
  });
});

describe("provider connection client requests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists provider connections", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        connections: [exampleConnection],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProviderConnectionsRequest();

    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]?.name).toBe("Google Workspace");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/provider-connections",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("loads the shared provider catalog", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        templates: [
          {
            id: "openrouter",
            category: "GLOBAL",
            name: "OpenRouter",
            subtitle: "全球聚合平台，适合自动发现 + 过滤模型",
            provider: "OPENAI_COMPATIBLE",
            suggestedBaseUrl: "https://openrouter.ai/api/v1",
            preferredDiscoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
            officialUrl: "https://openrouter.ai",
            apiKeyUrl: "https://openrouter.ai",
            docsUrl: "https://openrouter.ai",
            note: "模型很多，建议拉取后只保留准备使用的模型。",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProviderCatalogRequest();

    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]?.id).toBe("openrouter");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/provider-catalog",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("creates and updates a provider connection through the new endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ connection: exampleConnection }, { status: 201 }))
      .mockResolvedValueOnce(
        createJsonResponse({
          connection: {
            ...exampleConnection,
            name: "Google Workspace Updated",
            enabled: false,
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const created = await createProviderConnectionRequest({
      name: "Google Workspace",
      provider: "GEMINI",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: "test-key",
      discoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
      enabled: true,
    });
    const updated = await updateProviderConnectionRequest("connection-1", {
      name: "Google Workspace Updated",
      enabled: false,
    });

    expect(created.connection.name).toBe("Google Workspace");
    expect(updated.connection.name).toBe("Google Workspace Updated");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/provider-connections");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/provider-connections/connection-1");
  });

  it("supports testing, discovering, reading, and deleting a provider connection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ connection: exampleConnection }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true, connection: exampleConnection }))
      .mockResolvedValueOnce(
        createJsonResponse({
          models: [{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: null }],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const connection = await fetchProviderConnectionByIdRequest("connection-1");
    const tested = await testProviderConnectionRequest("connection-1", { modelName: "gemini-2.5-flash" });
    const discovered = await discoverProviderModelsByConnectionRequest("connection-1");
    const deleted = await deleteProviderConnectionRequest("connection-1");

    expect(connection.connection.id).toBe("connection-1");
    expect(tested.ok).toBe(true);
    expect(discovered.models[0]?.id).toBe("gemini-2.5-flash");
    expect(deleted).toBeNull();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/provider-connections/connection-1/test");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/provider-connections/connection-1/discover-models");
    expect(fetchMock.mock.calls[3]?.[0]).toBe("/api/provider-connections/connection-1");
  });

  it("discovers models for an existing saved model", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        models: [{ id: "qwen-plus", label: "qwen-plus", description: null }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverProviderModelsBySavedModelRequest("model-1");

    expect(result.models[0]?.id).toBe("qwen-plus");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/models/model-1/discover-models",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("fetchJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON for successful requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse({
          ok: true,
        }),
      ),
    );

    await expect(fetchJson<{ ok: boolean }>("/api/test")).resolves.toEqual({
      ok: true,
    });
  });

  it("returns null for 204 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    await expect(fetchJson<null>("/api/test")).resolves.toBeNull();
  });

  it("surfaces structured API errors from JSON payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createJsonResponse(
          {
            error: "Invalid request payload.",
            details: {
              reasonCode: "invalid_request_payload",
            },
          },
          {
            status: 400,
          },
        ),
      ),
    );

    await expect(fetchJson("/api/test")).rejects.toMatchObject({
      message: "Invalid request payload.",
      status: 400,
      details: {
        reasonCode: "invalid_request_payload",
      },
    });
  });

  it("falls back to a generic client error for non-JSON error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html>bad gateway</html>", {
          status: 502,
          headers: {
            "Content-Type": "text/html",
          },
        }),
      ),
    );

    await expect(fetchJson("/api/test")).rejects.toMatchObject({
      message: "请求失败。",
      status: 502,
    });
  });
});
