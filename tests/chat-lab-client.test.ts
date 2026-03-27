import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countAssistantRepliesForUserMessage,
  createProviderConnectionRequest,
  ClientRequestError,
  deleteProviderConnectionRequest,
  describeClientError,
  describePartialSendResult,
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
} from "@/lib/client/chat-lab-client";
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
        failedModelId: "model-b",
        error: "Provider timeout",
        providerErrorKind: "network",
      },
      "Mock Beta",
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 未完成本轮回复",
      tone: "warning",
    });
    expect(feedback?.suggestion).toContain("Base URL");
  });

  it("surfaces upstream zero-token diagnostics for empty responses", () => {
    const feedback = describePartialSendResult(
      {
        roomId: "room-1",
        status: "partial",
        failedModelId: "model-b",
        error: "The provider returned an empty response without a usable final answer. finish_reason=stop. completion_tokens=0.",
        providerErrorKind: "empty_response",
        providerErrorDetails: {
          finishReason: "stop",
          attemptCount: 2,
          completionTokens: 0,
        },
      },
      "Mock Beta",
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
        failedModelId: "model-b",
        error: "Provider quota or billing check failed with 429: token is exhausted.",
        providerErrorKind: "quota",
        failedModelPaused: true,
        failedModelPauseReason: "Model Mock Beta was automatically paused after the provider reported quota or token exhaustion.",
      },
      "Mock Beta",
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
        failedModelId: "model-b",
        error: "Provider returned reasoning content but no final answer after 2 attempts.",
        providerErrorKind: "reasoning_only",
      },
      "Mock Beta",
    );

    expect(feedback).toMatchObject({
      title: "Mock Beta 只返回了推理内容",
      tone: "warning",
    });
    expect(feedback?.suggestion).toContain("超短输入");
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
