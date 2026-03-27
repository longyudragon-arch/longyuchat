import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/http/api-error";
import { sendRoomMessage } from "@/server/services/room-message-service";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import type { ChatMessage, ModelRuntimeConfig } from "@/types/chat";

function buildConfig(id: string, enabled = true) {
  return {
    id,
    name: id,
    connectionId: null,
    provider: "OPENAI_COMPATIBLE" as const,
    baseUrl: "https://example.com/v1",
    modelName: `${id}-model`,
    avatarLabel: "OA",
    avatarColor: "#10b981",
    apiKey: `${id}-key`,
    defaultReplyLength: 300,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
    enabled,
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
  };
}

function createHistoryStore() {
  const history: Array<{
    roomId: string;
    sequence: number;
    role: "USER" | "ASSISTANT";
    content: string;
    modelId: string | null;
    createdAt: Date;
    id: string;
  }> = [];

  return {
    history,
    createUserMessage: async (roomId: string, content: string) => {
      const message = {
        id: `user-${history.length + 1}`,
        roomId,
        sequence: history.length + 1,
        role: "USER" as const,
        modelId: null,
        content,
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      };
      history.push(message);
      return message;
    },
    createAssistantMessage: async (roomId: string, modelId: string, content: string) => {
      const message = {
        id: `${modelId}-${history.length + 1}`,
        roomId,
        sequence: history.length + 1,
        role: "ASSISTANT" as const,
        modelId,
        content,
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      };
      history.push(message);
      return message;
    },
    listMessagesByRoomId: async () => [...history],
  };
}

function createRoom(roomId: string, models = [buildConfig("model-a"), buildConfig("model-b")]) {
  return {
    id: roomId,
    title: `Room ${roomId}`,
    type: "GROUP" as const,
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    roomModels: models.map((model, index) => ({
      id: `rm-${index + 1}`,
      roomId,
      modelId: model.id,
      sortOrder: index + 1,
      model,
    })),
  };
}

describe("sendRoomMessage", () => {
  it("persists the user message and runs sequential assistant replies", async () => {
    const store = createHistoryStore();
    const seenMessages = new Map<string, ChatMessage[]>();

    const createAdapter = (config: ModelRuntimeConfig): ModelAdapter => ({
      testConnection: vi.fn(),
      generateReply: vi.fn(async ({ messages }) => {
        seenMessages.set(config.id, [...messages]);
        return {
          content: config.id === "model-a" ? "First response" : "Second response",
        };
      }),
    });

    const result = await sendRoomMessage(
      {
        roomId: "room-1",
        content: "Start the thread",
      },
      {
        getRoomById: async () => createRoom("room-1"),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter,
        pauseModel: vi.fn(),
      },
    );

    expect(result.status).toBe("completed");
    expect(result.userMessage.sequence).toBe(1);
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a", "model-b"]);
    expect(seenMessages.get("model-a")).toEqual([
      {
        role: "system",
        content:
          "你必须直接给出可见的最终答案。默认使用简体中文回复；只有当用户明确要求其他语言时，才切换到对应语言。如果本轮用户输入很短、只有数字、符号，或像“1”“继续”“嗯”这样语言信息不足，也要结合更早的用户消息理解意图；如果仍然无法判断，就继续使用简体中文。最终答案必须控制在 300 个可见字符以内（含标点与空格）。如果初稿更长，请先压缩再回答，不要超过限制。",
      },
      { role: "user", content: "Start the thread", modelId: null, sequence: 1 },
      {
        role: "system",
        content:
          "你是 model-a。请基于以上对话继续本轮多模型讨论，从你自己的视角直接回答。上文可能包含其他 AI 模型的回复，但你仍然必须给出自己的最终答案，不要保持沉默，也不要只输出思考过程。",
      },
    ]);
    expect(seenMessages.get("model-b")).toEqual([
      {
        role: "system",
        content:
          "你必须直接给出可见的最终答案。默认使用简体中文回复；只有当用户明确要求其他语言时，才切换到对应语言。如果本轮用户输入很短、只有数字、符号，或像“1”“继续”“嗯”这样语言信息不足，也要结合更早的用户消息理解意图；如果仍然无法判断，就继续使用简体中文。最终答案必须控制在 300 个可见字符以内（含标点与空格）。如果初稿更长，请先压缩再回答，不要超过限制。",
      },
      { role: "user", content: "Start the thread", modelId: null, sequence: 1 },
      { role: "assistant", content: "First response", modelId: "model-a", sequence: 2 },
      {
        role: "system",
        content:
          "你是 model-b。请基于以上对话继续本轮多模型讨论，从你自己的视角直接回答。上文可能包含其他 AI 模型的回复，但你仍然必须给出自己的最终答案，不要保持沉默，也不要只输出思考过程。",
      },
    ]);
  });

  it("returns partial success after the first adapter failure", async () => {
    const store = createHistoryStore();

    const result = await sendRoomMessage(
      {
        roomId: "room-2",
        content: "Keep going",
      },
      {
        getRoomById: async () => createRoom("room-2"),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig) => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            if (config.id === "model-b") {
              throw new Error("Provider timeout");
            }

            return { content: "First response" };
          }),
        }),
        pauseModel: vi.fn(),
      },
    );

    expect(result.status).toBe("partial");
    expect(result.failedModelId).toBe("model-b");
    expect(result.providerErrorKind).toBe("network");
    expect(result.failedModelPaused).toBe(false);
    expect(result.assistantMessages).toHaveLength(1);
    expect(result.assistantMessages[0]?.modelId).toBe("model-a");
    expect(store.history).toHaveLength(2);
  });

  it("automatically pauses the failed model for quota-like provider errors", async () => {
    const store = createHistoryStore();
    const pauseModel = vi.fn(async () => buildConfig("model-b", false));

    const result = await sendRoomMessage(
      {
        roomId: "room-3",
        content: "继续",
      },
      {
        getRoomById: async () => createRoom("room-3"),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig) => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            if (config.id === "model-b") {
              throw new ApiError(429, "Provider quota or billing check failed with 429: token is exhausted.", {
                providerErrorKind: "quota",
              });
            }

            return { content: "First response" };
          }),
        }),
        pauseModel,
      },
    );

    expect(result.status).toBe("partial");
    expect(result.providerErrorKind).toBe("quota");
    expect(result.failedModelPaused).toBe(true);
    expect(result.failedModelPauseReason).toContain("quota or token exhaustion");
    expect(pauseModel).toHaveBeenCalledWith(
      "model-b",
      expect.stringContaining("automatically paused after the provider reported quota or token exhaustion"),
    );
  });

  it("does not auto-pause a model for transient empty-response failures", async () => {
    const store = createHistoryStore();
    const pauseModel = vi.fn(async () => buildConfig("model-b", false));

    const result = await sendRoomMessage(
      {
        roomId: "room-4",
        content: "继续",
      },
      {
        getRoomById: async () => createRoom("room-4"),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig) => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            if (config.id === "model-b") {
              throw new ApiError(502, "The provider returned an empty response without a usable final answer.", {
                providerErrorKind: "empty_response",
                finishReason: "stop",
                attemptCount: 2,
                completionTokens: 0,
              });
            }

            return { content: "First response" };
          }),
        }),
        pauseModel,
      },
    );

    expect(result.status).toBe("partial");
    expect(result.providerErrorKind).toBe("empty_response");
    expect(result.providerErrorDetails).toMatchObject({
      finishReason: "stop",
      attemptCount: 2,
      completionTokens: 0,
    });
    expect(result.failedModelPaused).toBe(false);
    expect(result.failedModelPauseReason).toBeUndefined();
    expect(pauseModel).not.toHaveBeenCalled();
  });

  it("rejects missing rooms before persisting any message", async () => {
    await expect(
      sendRoomMessage(
        {
          roomId: "missing-room",
          content: "Hello",
        },
        {
          getRoomById: async () => null,
          listMessagesByRoomId: vi.fn(),
          createUserMessage: vi.fn(),
          createAssistantMessage: vi.fn(),
          createAdapter: vi.fn(),
          pauseModel: vi.fn(),
        },
      ),
    ).rejects.toMatchObject<ApiError>({
      status: 404,
      message: "Room missing-room was not found.",
    });
  });

  it("rejects disabled models before persisting the user message", async () => {
    const createUserMessage = vi.fn();
    const createAssistantMessage = vi.fn();

    await expect(
      sendRoomMessage(
        {
          roomId: "room-disabled",
          content: "Hello",
        },
        {
          getRoomById: async () => createRoom("room-disabled", [buildConfig("model-a", false)]),
          listMessagesByRoomId: vi.fn(),
          createUserMessage,
          createAssistantMessage,
          createAdapter: vi.fn(),
          pauseModel: vi.fn(),
        },
      ),
    ).rejects.toMatchObject<ApiError>({
      status: 409,
      message: "Model model-a is disabled.",
    });

    expect(createUserMessage).not.toHaveBeenCalled();
    expect(createAssistantMessage).not.toHaveBeenCalled();
  });

  it("rejects rooms that do not have any bound models", async () => {
    await expect(
      sendRoomMessage(
        {
          roomId: "room-empty",
          content: "Hello",
        },
        {
          getRoomById: async () => ({
            ...createRoom("room-empty"),
            roomModels: [],
          }),
          listMessagesByRoomId: vi.fn(),
          createUserMessage: vi.fn(),
          createAssistantMessage: vi.fn(),
          createAdapter: vi.fn(),
          pauseModel: vi.fn(),
        },
      ),
    ).rejects.toMatchObject<ApiError>({
      status: 400,
      message: "Room room-empty does not have any bound models.",
    });
  });
});
