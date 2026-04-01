import { describe, expect, it, vi } from "vitest";

import type { ModelConfig, ProviderConnection } from "@/generated/prisma/client";
import { getProviderProbeModelName } from "@/lib/provider-catalog";
import {
  discoverModelsByConnectionId,
  testProviderConnectionById,
} from "@/server/services/provider-connection-service";
import {
  createModelConfigWithDependencies,
  updateModelConfigWithDependencies,
} from "@/server/services/model-config-service";
import { sendRoomMessage } from "@/server/services/room-message-service";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import type { ModelRuntimeConfig } from "@/types/chat";

function buildConnection(
  id: string,
  overrides: Partial<ProviderConnection> = {},
): ProviderConnection {
  return {
    id,
    name: `Connection ${id}`,
    provider: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "secret-key",
    discoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    enabled: true,
    lastAuthStatus: null,
    lastAuthMessage: null,
    lastAuthCheckedAt: null,
    lastDiscoveryStatus: null,
    lastDiscoveryMessage: null,
    lastDiscoveredAt: null,
    createdAt: new Date("2026-03-25T00:00:00.000Z"),
    updatedAt: new Date("2026-03-25T00:00:00.000Z"),
    ...overrides,
  };
}

function buildModel(id: string, overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id,
    name: `Model ${id}`,
    connectionId: null,
    provider: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1-mini",
    avatarLabel: "OA",
    avatarColor: "#10b981",
    apiKey: "secret-key",
    defaultReplyLength: 300,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
    enabled: true,
    createdAt: new Date("2026-03-25T00:00:00.000Z"),
    updatedAt: new Date("2026-03-25T00:00:00.000Z"),
    ...overrides,
  };
}

function createHistoryStore() {
  const history: Array<{
    id: string;
    roomId: string;
    sequence: number;
    role: "USER" | "ASSISTANT";
    modelId: string | null;
    content: string;
    replyDurationMs: number | null;
    queueDurationMs: number | null;
    providerRequestDurationMs: number | null;
    providerAttemptCount: number | null;
    recoveryRequestDurationMs: number | null;
    rewriteRequestDurationMs: number | null;
    persistenceDurationMs: number | null;
    model: null;
    speakerName: string | null;
    speakerProvider: string | null;
    speakerModelName: string | null;
    speakerAvatarLabel: string | null;
    speakerAvatarColor: string | null;
    createdAt: Date;
  }> = [];

  return {
    listMessagesByRoomId: async () => [...history],
    createUserMessage: async (roomId: string, content: string) => {
      const message = {
        id: `user-${history.length + 1}`,
        roomId,
        sequence: history.length + 1,
        role: "USER" as const,
        modelId: null,
        content,
        replyDurationMs: null,
        queueDurationMs: null,
        providerRequestDurationMs: null,
        providerAttemptCount: null,
        recoveryRequestDurationMs: null,
        rewriteRequestDurationMs: null,
        persistenceDurationMs: null,
        model: null,
        speakerName: null,
        speakerProvider: null,
        speakerModelName: null,
        speakerAvatarLabel: null,
        speakerAvatarColor: null,
        createdAt: new Date("2026-03-25T03:00:00.000Z"),
      };
      history.push(message);
      return message;
    },
    createAssistantMessage: async (
      roomId: string,
      modelId: string,
      content: string,
      replyDurationMs?: number | null,
      speaker?: {
        name: string;
        provider: string;
        modelName: string;
        avatarLabel: string;
        avatarColor: string;
      },
      replyTiming?: {
        queueDurationMs?: number | null;
        providerRequestDurationMs?: number | null;
        providerAttemptCount?: number | null;
        recoveryRequestDurationMs?: number | null;
        rewriteRequestDurationMs?: number | null;
        persistenceDurationMs?: number | null;
      } | null,
    ) => {
      const message = {
        id: `${modelId}-${history.length + 1}`,
        roomId,
        sequence: history.length + 1,
        role: "ASSISTANT" as const,
        modelId,
        content,
        replyDurationMs: replyDurationMs ?? null,
        queueDurationMs: replyTiming?.queueDurationMs ?? null,
        providerRequestDurationMs: replyTiming?.providerRequestDurationMs ?? null,
        providerAttemptCount: replyTiming?.providerAttemptCount ?? null,
        recoveryRequestDurationMs: replyTiming?.recoveryRequestDurationMs ?? null,
        rewriteRequestDurationMs: replyTiming?.rewriteRequestDurationMs ?? null,
        persistenceDurationMs: replyTiming?.persistenceDurationMs ?? null,
        model: null,
        speakerName: speaker?.name ?? null,
        speakerProvider: speaker?.provider ?? null,
        speakerModelName: speaker?.modelName ?? null,
        speakerAvatarLabel: speaker?.avatarLabel ?? null,
        speakerAvatarColor: speaker?.avatarColor ?? null,
        createdAt: new Date("2026-03-25T03:00:01.000Z"),
      };
      history.push(message);
      return message;
    },
  };
}

function createRoomFromModels(roomId: string, models: ModelConfig[]) {
  return {
    id: roomId,
    title: `Room ${roomId}`,
    type: "GROUP" as const,
    createdAt: new Date("2026-03-25T03:00:00.000Z"),
    updatedAt: new Date("2026-03-25T03:00:00.000Z"),
    roomModels: models.map((model, index) => ({
      id: `rm-${index + 1}`,
      roomId,
      modelId: model.id,
      sortOrder: index + 1,
      executionState: "ACTIVE" as const,
      cooldownUntil: null,
      consecutiveFailureCount: 0,
      timeoutCount: 0,
      lastFailureKind: null,
      lastFailureMessage: null,
      lastFailureAt: null,
      lastSuccessAt: null,
      lastRecoveryAt: null,
      model,
    })),
  };
}

function createConnectionState(connection: ProviderConnection) {
  const state = { connection };

  return {
    state,
    getConnectionById: async (id: string) => (id === state.connection.id ? state.connection : null),
    persistAuthResult: async (
      id: string,
      input: { status: "SUCCESS" | "ERROR"; message: string; checkedAt?: Date },
    ) => {
      if (id !== state.connection.id) {
        throw new Error("Unexpected connection id");
      }

      state.connection = {
        ...state.connection,
        lastAuthStatus: input.status,
        lastAuthMessage: input.message,
        lastAuthCheckedAt: input.checkedAt ?? new Date("2026-03-25T01:00:00.000Z"),
      };

      return state.connection;
    },
    persistDiscoveryResult: async (
      id: string,
      input: { status: "SUCCESS" | "ERROR"; message: string; checkedAt?: Date },
    ) => {
      if (id !== state.connection.id) {
        throw new Error("Unexpected connection id");
      }

      state.connection = {
        ...state.connection,
        lastDiscoveryStatus: input.status,
        lastDiscoveryMessage: input.message,
        lastDiscoveredAt: input.checkedAt ?? new Date("2026-03-25T01:05:00.000Z"),
      };

      return state.connection;
    },
  };
}

describe("provider capability matrix", () => {
  it("keeps auth success separate from discovery failure and still allows manual fallback model creation", async () => {
    const connectionState = createConnectionState(
      buildConnection("conn-bigmodel", {
        name: "BigModel 主连接",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      }),
    );
    const testConnection = vi.fn(async () => undefined);
    const discoverProviderModels = vi.fn(async () => {
      throw new Error("The provider did not return a model list.");
    });
    const createModel = vi.fn(async (input) =>
      buildModel("model-bigmodel", {
        name: input.name,
        connectionId: input.connectionId,
        provider: input.provider,
        baseUrl: input.baseUrl,
        modelName: input.modelName,
        avatarLabel: input.avatarLabel,
        avatarColor: input.avatarColor,
        apiKey: input.apiKey,
      }),
    );

    await testProviderConnectionById(
      "conn-bigmodel",
      {},
      {
        getConnectionById: connectionState.getConnectionById,
        persistAuthResult: connectionState.persistAuthResult,
        discoverProviderModels,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          expect(config.modelName).toBe("glm-4-flash");

          return {
            testConnection,
            generateReply: vi.fn(),
          };
        },
      },
    );

    await expect(
      discoverModelsByConnectionId("conn-bigmodel", {
        getConnectionById: connectionState.getConnectionById,
        persistDiscoveryResult: connectionState.persistDiscoveryResult,
        discoverProviderModels,
      }),
    ).rejects.toThrow("The provider did not return a model list.");

    const createdModel = await createModelConfigWithDependencies(
      {
        name: "GLM 主模型",
        connectionId: "conn-bigmodel",
        modelName: "glm-4-flash",
      },
      {
        getConnectionById: connectionState.getConnectionById,
        createModel,
      },
    );

    expect(testConnection).toHaveBeenCalledTimes(1);
    expect(connectionState.state.connection.lastAuthStatus).toBe("SUCCESS");
    expect(connectionState.state.connection.lastDiscoveryStatus).toBe("ERROR");
    expect(connectionState.state.connection.lastAuthMessage).toContain("probe model glm-4-flash");
    expect(createdModel.connectionId).toBe("conn-bigmodel");
    expect(createdModel.provider).toBe("OPENAI_COMPATIBLE");
    expect(createdModel.baseUrl).toBe("https://open.bigmodel.cn/api/paas/v4");
  });

  it("supports a full auth-plus-discovery success path for auto-fetch providers", async () => {
    const connectionState = createConnectionState(
      buildConnection("conn-gemini", {
        name: "Gemini 主连接",
        provider: "GEMINI",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      }),
    );
    const testConnection = vi.fn(async () => undefined);
    const discoverProviderModels = vi.fn(async () => [
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash", description: null },
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro", description: null },
    ]);

    await testProviderConnectionById(
      "conn-gemini",
      {},
      {
        getConnectionById: connectionState.getConnectionById,
        persistAuthResult: connectionState.persistAuthResult,
        discoverProviderModels,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          expect(config.modelName).toBe("gemini-2.5-flash");

          return {
            testConnection,
            generateReply: vi.fn(),
          };
        },
      },
    );

    const discoveredModels = await discoverModelsByConnectionId("conn-gemini", {
      getConnectionById: connectionState.getConnectionById,
      persistDiscoveryResult: connectionState.persistDiscoveryResult,
      discoverProviderModels,
    });

    expect(discoveredModels).toHaveLength(2);
    expect(connectionState.state.connection.lastAuthStatus).toBe("SUCCESS");
    expect(connectionState.state.connection.lastDiscoveryStatus).toBe("SUCCESS");
    expect(connectionState.state.connection.lastDiscoveryMessage).toBe("Discovered 2 model(s).");
  });

  it("supports linked model switch and detach without breaking provider snapshots", async () => {
    const connections = new Map<string, ProviderConnection>([
      [
        "conn-gemini",
        buildConnection("conn-gemini", {
          provider: "GEMINI",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKey: "gemini-secret",
        }),
      ],
      [
        "conn-grok",
        buildConnection("conn-grok", {
          provider: "GROK",
          baseUrl: "https://api.x.ai/v1",
          apiKey: "grok-secret",
        }),
      ],
    ]);

    let storedModel = buildModel("model-linked", {
      name: "可切换模型",
      connectionId: "conn-gemini",
      provider: "GEMINI",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      modelName: "gemini-2.5-flash",
      avatarLabel: "GM",
      avatarColor: "#0ea5e9",
      apiKey: "gemini-secret",
    });

    const updateModel = vi.fn(async (_id: string, input) => {
      storedModel = {
        ...storedModel,
        ...Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
        ),
        connectionId: input.connectionId === undefined ? storedModel.connectionId : input.connectionId,
        updatedAt: new Date("2026-03-25T02:00:00.000Z"),
      };

      return storedModel;
    });

    const switchedModel = await updateModelConfigWithDependencies(
      "model-linked",
      {
        connectionId: "conn-grok",
        modelName: "grok-3-mini",
        avatarColor: "#8b5cf6",
      },
      {
        getModelById: async () => storedModel,
        getConnectionById: async (id) => connections.get(id) ?? null,
        updateModel,
      },
    );

    expect(switchedModel.connectionId).toBe("conn-grok");
    expect(switchedModel.provider).toBe("GROK");
    expect(switchedModel.baseUrl).toBe("https://api.x.ai/v1");
    expect(switchedModel.apiKey).toBe("grok-secret");
    expect(switchedModel.avatarColor).toBe("#8b5cf6");

    const detachedModel = await updateModelConfigWithDependencies(
      "model-linked",
      {
        connectionId: null,
        provider: "DEEPSEEK",
        baseUrl: "https://api.deepseek.com/v1",
        modelName: "deepseek-chat",
        apiKey: "direct-secret",
        avatarColor: "#06b6d4",
      },
      {
        getModelById: async () => storedModel,
        getConnectionById: async (id) => connections.get(id) ?? null,
        updateModel,
      },
    );

    expect(detachedModel.connectionId).toBeNull();
    expect(detachedModel.provider).toBe("DEEPSEEK");
    expect(detachedModel.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(detachedModel.modelName).toBe("deepseek-chat");
    expect(detachedModel.avatarColor).toBe("#06b6d4");
  });

  it("keeps the connection -> manual fallback model -> chat path runnable when discovery fails", async () => {
    const connectionState = createConnectionState(
      buildConnection("conn-openrouter", {
        name: "OpenRouter 主连接",
        baseUrl: "https://openrouter.ai/api/v1",
      }),
    );
    const discoverProviderModels = vi.fn(async () => {
      throw new Error("The provider did not return a model list.");
    });
    const testConnection = vi.fn(async () => undefined);

    let storedModel: ModelConfig | null = null;
    const createModel = vi.fn(async (input) => {
      storedModel = buildModel("model-openrouter", {
        name: input.name,
        connectionId: input.connectionId,
        provider: input.provider,
        baseUrl: input.baseUrl,
        modelName: input.modelName,
        avatarLabel: input.avatarLabel,
        avatarColor: input.avatarColor,
        apiKey: input.apiKey,
      });

      return storedModel;
    });

    await testProviderConnectionById(
      "conn-openrouter",
      {},
      {
        getConnectionById: connectionState.getConnectionById,
        persistAuthResult: connectionState.persistAuthResult,
        discoverProviderModels,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          expect(config.modelName).toBe(
            getProviderProbeModelName("OPENAI_COMPATIBLE", "https://openrouter.ai/api/v1"),
          );
          return {
            testConnection,
            generateReply: vi.fn(),
          };
        },
      },
    );

    await expect(
      discoverModelsByConnectionId("conn-openrouter", {
        getConnectionById: connectionState.getConnectionById,
        persistDiscoveryResult: connectionState.persistDiscoveryResult,
        discoverProviderModels,
      }),
    ).rejects.toThrow("The provider did not return a model list.");

    const createdModel = await createModelConfigWithDependencies(
      {
        name: "OpenRouter 手动模型",
        connectionId: "conn-openrouter",
        modelName: "openai/gpt-4.1-mini",
      },
      {
        getConnectionById: connectionState.getConnectionById,
        createModel,
      },
    );

    const seenConfigs: ModelRuntimeConfig[] = [];
    const store = createHistoryStore();

    const result = await sendRoomMessage(
      {
        roomId: "room-openrouter",
        content: "请继续。",
      },
      {
        getRoomById: async () => createRoomFromModels("room-openrouter", [createdModel, buildModel("model-direct-b")]),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          seenConfigs.push(config);
          return {
            testConnection: vi.fn(),
            generateReply: vi.fn(async () => ({
              content: `${config.name} 已响应`,
            })),
          };
        },
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(connectionState.state.connection.lastAuthStatus).toBe("SUCCESS");
    expect(connectionState.state.connection.lastDiscoveryStatus).toBe("ERROR");
    expect(result.status).toBe("completed");
    expect(seenConfigs[0]).toMatchObject({
      id: "model-openrouter",
      provider: "OPENAI_COMPATIBLE",
      baseUrl: "https://openrouter.ai/api/v1",
      modelName: "openai/gpt-4.1-mini",
    });
  });

  it("uses the switched connection snapshot first and the detached direct config afterwards during chat", async () => {
    const connections = new Map<string, ProviderConnection>([
      [
        "conn-gemini",
        buildConnection("conn-gemini", {
          provider: "GEMINI",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
          apiKey: "gemini-secret",
        }),
      ],
      [
        "conn-qwen",
        buildConnection("conn-qwen", {
          provider: "QWEN",
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          apiKey: "qwen-secret",
        }),
      ],
    ]);

    let storedModel = buildModel("model-linked-chat", {
      name: "可切换聊天模型",
      connectionId: "conn-gemini",
      provider: "GEMINI",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      modelName: "gemini-2.5-flash",
      avatarLabel: "GM",
      avatarColor: "#0ea5e9",
      apiKey: "gemini-secret",
    });

    const updateModel = vi.fn(async (_id: string, input) => {
      storedModel = {
        ...storedModel,
        ...Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
        ),
        connectionId: input.connectionId === undefined ? storedModel.connectionId : input.connectionId,
        updatedAt: new Date("2026-03-25T04:00:00.000Z"),
      };

      return storedModel;
    });

    const switchedModel = await updateModelConfigWithDependencies(
      "model-linked-chat",
      {
        connectionId: "conn-qwen",
        modelName: "qwen-plus",
        avatarColor: "#8b5cf6",
      },
      {
        getModelById: async () => storedModel,
        getConnectionById: async (id) => connections.get(id) ?? null,
        updateModel,
      },
    );

    const switchedConfigs: ModelRuntimeConfig[] = [];
    const switchedStore = createHistoryStore();
    await sendRoomMessage(
      {
        roomId: "room-switched",
        content: "切换后发一轮。",
      },
      {
        getRoomById: async () => createRoomFromModels("room-switched", [switchedModel, buildModel("model-direct-c")]),
        listMessagesByRoomId: switchedStore.listMessagesByRoomId,
        createUserMessage: switchedStore.createUserMessage,
        createAssistantMessage: switchedStore.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          switchedConfigs.push(config);
          return {
            testConnection: vi.fn(),
            generateReply: vi.fn(async () => ({ content: `${config.modelName} replied` })),
          };
        },
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(switchedConfigs[0]).toMatchObject({
      id: "model-linked-chat",
      provider: "QWEN",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      modelName: "qwen-plus",
      apiKey: "qwen-secret",
    });

    const detachedModel = await updateModelConfigWithDependencies(
      "model-linked-chat",
      {
        connectionId: null,
        provider: "DEEPSEEK",
        baseUrl: "https://api.deepseek.com/v1",
        modelName: "deepseek-chat",
        apiKey: "direct-secret",
        avatarColor: "#06b6d4",
      },
      {
        getModelById: async () => storedModel,
        getConnectionById: async (id) => connections.get(id) ?? null,
        updateModel,
      },
    );

    const detachedConfigs: ModelRuntimeConfig[] = [];
    const detachedStore = createHistoryStore();
    await sendRoomMessage(
      {
        roomId: "room-detached",
        content: "解绑后再发一轮。",
      },
      {
        getRoomById: async () => createRoomFromModels("room-detached", [detachedModel, buildModel("model-direct-d")]),
        listMessagesByRoomId: detachedStore.listMessagesByRoomId,
        createUserMessage: detachedStore.createUserMessage,
        createAssistantMessage: detachedStore.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          detachedConfigs.push(config);
          return {
            testConnection: vi.fn(),
            generateReply: vi.fn(async () => ({ content: `${config.modelName} replied` })),
          };
        },
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(detachedConfigs[0]).toMatchObject({
      id: "model-linked-chat",
      provider: "DEEPSEEK",
      baseUrl: "https://api.deepseek.com/v1",
      modelName: "deepseek-chat",
      apiKey: "direct-secret",
    });
  });
});
