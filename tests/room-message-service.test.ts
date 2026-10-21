import { describe, expect, it, vi } from "vitest";
import type { ChatRoom, ChatRoomModel, Message, ModelConfig } from "@/generated/prisma/client";

import { ApiError } from "@/server/http/api-error";
import { sendRoomMessage } from "@/server/services/room-message-service";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import { buildParticipantRosterInstruction, buildParticipationInstruction, buildReplyLengthInstruction } from "@/server/orchestrators/conversation-orchestrator";
import type { ChatMessage, ModelRuntimeConfig } from "@/types/chat";

function buildConfig(id: string, enabled = true): ModelConfig {
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
  const history: Array<Message & { model?: ModelConfig | null }> = [];

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
        replyDurationMs: null,
        queueDurationMs: null,
        persistenceDurationMs: null,
        providerRequestDurationMs: null,
        providerAttemptCount: null,
        recoveryRequestDurationMs: null,
        rewriteRequestDurationMs: null,
        model: null,
        speakerName: null,
        speakerProvider: null,
        speakerModelName: null,
        speakerAvatarLabel: null,
        speakerAvatarColor: null,
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
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
        provider: ModelConfig["provider"];
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
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      };
      history.push(message);
      return message;
    },
    listMessagesByRoomId: async () => [...history],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function createRoom(roomId: string, models = [buildConfig("model-a"), buildConfig("model-b")]): ChatRoom & { roomModels: Array<ChatRoomModel & { model: ModelConfig }> } {
  return {
    id: roomId,
    title: `Room ${roomId}`,
    nextMessageSequence: 1,
    type: "GROUP" as const,
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
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

describe("sendRoomMessage", () => {
  it("persists the user message and runs sequential assistant replies", async () => {
    const store = createHistoryStore();
    const seenMessages = new Map<string, ChatMessage[]>();
    const clearRoomModelFailure = vi.fn();

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
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.userMessage.sequence).toBe(1);
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a", "model-b"]);
    expect(result.assistantMessages.every((message) => typeof message.replyDurationMs === "number")).toBe(true);
    expect(seenMessages.get("model-a")).toEqual([
      buildReplyLengthInstruction(buildConfig("model-a")),
      buildParticipantRosterInstruction(
        [
          { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
          { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
        ],
        { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
      ),
      { role: "user", content: "Start the thread" },
      buildParticipationInstruction(buildConfig("model-a")),
    ]);
    expect(seenMessages.get("model-b")).toEqual([
      buildReplyLengthInstruction(buildConfig("model-b")),
      buildParticipantRosterInstruction(
        [
          { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
          { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
        ],
        { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
      ),
      { role: "user", content: "Start the thread" },
      {
        role: "system",
        content:
          "以下是房间中其他模型「model-a（model-a-model）」的参考发言，供应商为「OPENAI_COMPATIBLE」。这不是你自己的历史回复，也不代表你的身份或既有立场，请仅作为参考：\nFirst response",
      },
      buildParticipationInstruction(buildConfig("model-b")),
    ]);
    expect(clearRoomModelFailure).toHaveBeenCalledWith("room-1", "model-a");
    expect(clearRoomModelFailure).toHaveBeenCalledWith("room-1", "model-b");
  });

  it("prefers persisted speaker snapshots from stored history when building later-model context", async () => {
    const store = createHistoryStore();
    store.history.push(
      {
        id: "user-1",
        roomId: "room-history",
        sequence: 1,
        role: "USER",
        modelId: null,
        content: "先继续刚才那个判断",
        replyDurationMs: null,
        queueDurationMs: null,
        persistenceDurationMs: null,
        providerRequestDurationMs: null,
        providerAttemptCount: null,
        recoveryRequestDurationMs: null,
        rewriteRequestDurationMs: null,
        model: null,
        speakerName: null,
        speakerProvider: null,
        speakerModelName: null,
        speakerAvatarLabel: null,
        speakerAvatarColor: null,
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      },
      {
        id: "assistant-2",
        roomId: "room-history",
        sequence: 2,
        role: "ASSISTANT",
        modelId: "model-a",
        content: "这是 model-a 在上一轮的结论",
        replyDurationMs: 1800,
        queueDurationMs: null,
        persistenceDurationMs: null,
        providerRequestDurationMs: null,
        providerAttemptCount: null,
        recoveryRequestDurationMs: null,
        rewriteRequestDurationMs: null,
        model: null,
        speakerName: "历史智谱助手",
        speakerProvider: "OPENAI_COMPATIBLE",
        speakerModelName: "glm-4.6",
        speakerAvatarLabel: "ZP",
        speakerAvatarColor: "#2563eb",
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
      },
    );

    const seenMessages = new Map<string, ChatMessage[]>();

    await sendRoomMessage(
      {
        roomId: "room-history",
        content: "继续",
      },
      {
        getRoomById: async () => createRoom("room-history"),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async ({ messages }) => {
            seenMessages.set(config.id, [...messages]);
            return {
              content: config.id === "model-a" ? "Model A next" : "Model B next",
            };
          }),
        }),
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(seenMessages.get("model-b")).toEqual(
      expect.arrayContaining([
        {
          role: "system",
          content:
            "以下是房间中其他模型「历史智谱助手（glm-4.6）」的参考发言，供应商为「OPENAI_COMPATIBLE」。这不是你自己的历史回复，也不代表你的身份或既有立场，请仅作为参考：\n这是 model-a 在上一轮的结论",
        },
      ]),
    );
  });

  it("preserves the user and earlier replies while stopping later models after failure", async () => {
    const store = createHistoryStore();
    const recordRoomModelTimeout = vi.fn();
    const recordRoomModelFailure = vi.fn();
    const markRoomModelInCooldown = vi.fn(async () => new Date("2026-03-30T10:10:00.000Z"));
    const createConversationRound = vi.fn(async () => ({
      id: "round-1",
      roomId: "room-2",
      userMessageId: "user-1",
      userMessageSequence: 1,
      status: "RUNNING" as const,
      startedAt: new Date("2026-03-30T10:00:00.000Z"),
      finishedAt: null,
    }));
    const markConversationRoundStepRunning = vi.fn();
    const markConversationRoundStepReplied = vi.fn();
    const markConversationRoundStepFailed = vi.fn();
    const finishConversationRound = vi.fn();

    const result = await sendRoomMessage(
      {
        roomId: "room-2",
        content: "Keep going",
      },
      {
        getRoomById: async () => createRoom("room-2", [buildConfig("model-a"), buildConfig("model-b"), buildConfig("model-c")]),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig) => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            if (config.id === "model-b") {
              throw new Error("Provider timeout");
            }

            return { content: `${config.id} response` };
          }),
        }),
        pauseModel: vi.fn(),
        recordRoomModelTimeout,
        recordRoomModelFailure,
        markRoomModelInCooldown,
        clearRoomModelFailure: vi.fn(),
        createConversationRound,
        markConversationRoundStepRunning,
        markConversationRoundStepReplied,
        markConversationRoundStepFailed,
        finishConversationRound,
      },
    );

    expect(result.status).toBe("partial");
    expect(result.failedModelId).toBe("model-b");
    expect(result.providerErrorKind).toBe("network");
    expect(result.failedModelPaused).toBe(false);
    expect(result.assistantMessages).toHaveLength(1);
    expect(result.assistantMessages[0]?.modelId).toBe("model-a");
    expect(result.assistantMessages[0]?.replyDurationMs).toBeTypeOf("number");
    expect(result.roundOutcomes).toEqual([
      {
        modelId: "model-a",
        modelName: "model-a",
        outcome: "replied",
      },
      {
        modelId: "model-b",
        modelName: "model-b",
        outcome: "failed",
        error: "Provider timeout",
        providerErrorKind: "network",
        providerErrorDetails: undefined,
        paused: false,
        pauseReason: undefined,
        cooldownUntil: "2026-03-30T10:10:00.000Z",
      },
    ]);
    expect(result.failedModelCooldownUntil).toBe("2026-03-30T10:10:00.000Z");
    expect(store.history.map((message) => [message.role, message.modelId])).toEqual([["USER", null], ["ASSISTANT", "model-a"]]);
    expect(result.skippedModels).toEqual([{ modelId: "model-c", name: "model-c", reason: "previous_failure", availableAt: null }]);
    expect(recordRoomModelTimeout).toHaveBeenCalledWith("room-2", "model-b");
    expect(markRoomModelInCooldown).toHaveBeenCalledWith(
      "room-2",
      "model-b",
      expect.objectContaining({
        kind: "network",
        message: "Provider timeout",
        occurredAt: expect.any(Date),
      }),
    );
    expect(recordRoomModelFailure).not.toHaveBeenCalled();
    expect(createConversationRound).toHaveBeenCalledWith({
      roomId: "room-2",
      userMessageId: "user-1",
      userMessageSequence: 1,
      steps: [
        { roomModelId: "rm-1", modelId: "model-a", sortOrder: 1, status: "PENDING" },
        { roomModelId: "rm-2", modelId: "model-b", sortOrder: 2, status: "PENDING" },
        { roomModelId: "rm-3", modelId: "model-c", sortOrder: 3, status: "PENDING" },
      ],
    });
    expect(markConversationRoundStepRunning).toHaveBeenNthCalledWith(1, "round-1", "rm-1");
    expect(markConversationRoundStepReplied).toHaveBeenNthCalledWith(1, "round-1", "rm-1", "model-a-2");
    expect(markConversationRoundStepRunning).toHaveBeenNthCalledWith(2, "round-1", "rm-2");
    expect(markConversationRoundStepFailed).toHaveBeenCalledWith("round-1", "rm-2", {
      errorKind: "network",
      errorMessage: "Provider timeout",
    });
    expect(markConversationRoundStepRunning).toHaveBeenCalledTimes(2);
    expect(markConversationRoundStepReplied).toHaveBeenCalledTimes(1);
    expect(finishConversationRound).toHaveBeenCalledWith("round-1", "PARTIAL");
  });

  it("stores reply duration on persisted assistant messages", async () => {
    const store = createHistoryStore();

    const result = await sendRoomMessage(
      {
        roomId: "room-duration",
        content: "测一下耗时",
      },
      {
        getRoomById: async () => createRoom("room-duration", [buildConfig("model-a")]),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: () => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => ({ content: "已记录耗时" })),
        }),
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(result.status).toBe("completed");
    expect(store.history[1]?.replyDurationMs).toBeTypeOf("number");
    expect(result.assistantMessages[0]?.replyDurationMs).toBeTypeOf("number");
  });

  it("persists provider timing telemetry alongside the assistant reply", async () => {
    const store = createHistoryStore();

    const result = await sendRoomMessage(
      {
        roomId: "room-telemetry",
        content: "拆一下本次耗时",
      },
      {
        getRoomById: async () => createRoom("room-telemetry", [buildConfig("model-a")]),
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: () => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => ({
            content: "已附带 timing telemetry",
            replyTiming: {
              queueDurationMs: 0,
              providerRequestDurationMs: 980,
              providerAttemptCount: 2,
              recoveryRequestDurationMs: 320,
              rewriteRequestDurationMs: null,
              persistenceDurationMs: null,
            },
          })),
        }),
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(result.status).toBe("completed");
    expect(store.history[1]).toMatchObject({
      queueDurationMs: expect.any(Number),
      providerRequestDurationMs: 980,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: 320,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: null,
    });
    expect(result.assistantMessages[0]?.replyTiming).toEqual({
      queueDurationMs: expect.any(Number),
      providerRequestDurationMs: 980,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: 320,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: null,
    });
  });

  it("automatically pauses the failed model for quota-like provider errors", async () => {
    const store = createHistoryStore();
    const pauseModel = vi.fn(async () => buildConfig("model-b", false));
    const markRoomModelInCooldown = vi.fn(async () => new Date("2026-03-30T10:10:00.000Z"));

    const result = await sendRoomMessage(
      {
        roomId: "room-3",
        content: "继续",
      },
      {
        getRoomById: async () => createRoom("room-3", [buildConfig("model-a"), buildConfig("model-b"), buildConfig("model-c")]),
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

            return { content: `${config.id} response` };
          }),
        }),
        pauseModel,
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        markRoomModelInCooldown,
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(result.status).toBe("partial");
    expect(result.providerErrorKind).toBe("quota");
    expect(result.failedModelPaused).toBe(true);
    expect(result.failedModelPauseReason).toContain("quota or token exhaustion");
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a"]);
    expect(result.roundOutcomes).toEqual([
      {
        modelId: "model-a",
        modelName: "model-a",
        outcome: "replied",
      },
      {
        modelId: "model-b",
        modelName: "model-b",
        outcome: "failed",
        error: "Provider quota or billing check failed with 429: token is exhausted.",
        providerErrorKind: "quota",
        providerErrorDetails: {
          finishReason: null,
          attemptCount: null,
          contentLength: null,
          reasoningLength: null,
          promptTokens: null,
          completionTokens: null,
          reasoningTokens: null,
          initialFinishReason: null,
          initialPromptTokens: null,
          initialCompletionTokens: null,
          initialReasoningTokens: null,
        },
        paused: true,
        pauseReason: expect.stringContaining("automatically paused after the provider reported quota or token exhaustion"),
        cooldownUntil: undefined,
      },
    ]);
    expect(pauseModel).toHaveBeenCalledWith(
      "model-b",
      expect.stringContaining("automatically paused after the provider reported quota or token exhaustion"),
    );
    expect(markRoomModelInCooldown).not.toHaveBeenCalled();
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
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
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
          recordRoomModelTimeout: vi.fn(),
          recordRoomModelFailure: vi.fn(),
          clearRoomModelFailure: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      status: 404,
      message: "Room missing-room was not found.",
    });
  });

  it("rejects rooms that do not currently have any runnable models before persisting the user message", async () => {
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
          recordRoomModelTimeout: vi.fn(),
          recordRoomModelFailure: vi.fn(),
          clearRoomModelFailure: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: "Room room-disabled does not currently have any runnable models. All models are disabled or cooling down.",
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
          recordRoomModelTimeout: vi.fn(),
          recordRoomModelFailure: vi.fn(),
          clearRoomModelFailure: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "Room room-empty does not have any bound models.",
      details: expect.objectContaining({
        reasonCode: "room_has_no_models",
        roomId: "room-empty",
      }),
    });
  });

  it("rejects overlapping sends for the same room while a round is already running", async () => {
    const store = createHistoryStore();
    const firstReply = createDeferred<{ content: string }>();

    const dependencies = {
      getRoomById: async () => createRoom("room-busy", [buildConfig("model-a")]),
      listMessagesByRoomId: store.listMessagesByRoomId,
      createUserMessage: store.createUserMessage,
      createAssistantMessage: store.createAssistantMessage,
      createAdapter: () => ({
        testConnection: vi.fn(),
        generateReply: vi.fn(async () => firstReply.promise),
      }),
      pauseModel: vi.fn(),
      recordRoomModelTimeout: vi.fn(),
      recordRoomModelFailure: vi.fn(),
      clearRoomModelFailure: vi.fn(),
    };

    const firstSend = sendRoomMessage(
      {
        roomId: "room-busy",
        content: "第一条消息",
      },
      dependencies,
    );

    await Promise.resolve();

    await expect(
      sendRoomMessage(
        {
          roomId: "room-busy",
          content: "第二条消息",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: "Room room-busy is already processing another message. Please wait for the current round to finish.",
      details: expect.objectContaining({
        reasonCode: "room_message_in_flight",
        roomId: "room-busy",
        retryable: true,
      }),
    });

    expect(store.history.filter((message) => message.role === "USER")).toHaveLength(1);
    expect(store.history.some((message) => message.role === "USER" && message.content === "第二条消息")).toBe(false);

    firstReply.resolve({ content: "已完成第一轮回复" });

    const firstResult = await firstSend;

    expect(firstResult.status).toBe("completed");

    const secondRound = await sendRoomMessage(
      {
        roomId: "room-busy",
        content: "第三条消息",
      },
      {
        ...dependencies,
        createAdapter: () => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => ({ content: "第二轮也能继续" })),
        }),
      },
    );

    expect(secondRound.status).toBe("completed");
  });

  it("releases the room lock after an unexpected service error so the next send can proceed", async () => {
    const store = createHistoryStore();
    const listMessagesByRoomId = vi
      .fn()
      .mockRejectedValueOnce(new Error("database temporarily unavailable"))
      .mockImplementation(store.listMessagesByRoomId);

    await expect(
      sendRoomMessage(
        {
          roomId: "room-recoverable-lock",
          content: "第一条消息",
        },
        {
          getRoomById: async () => createRoom("room-recoverable-lock", [buildConfig("model-a")]),
          listMessagesByRoomId,
          createUserMessage: store.createUserMessage,
          createAssistantMessage: store.createAssistantMessage,
          createAdapter: () => ({
            testConnection: vi.fn(),
            generateReply: vi.fn(async () => ({ content: "恢复后的回复" })),
          }),
          pauseModel: vi.fn(),
          recordRoomModelTimeout: vi.fn(),
          recordRoomModelFailure: vi.fn(),
          clearRoomModelFailure: vi.fn(),
        },
      ),
    ).rejects.toThrow("database temporarily unavailable");

    const recoveryResult = await sendRoomMessage(
      {
        roomId: "room-recoverable-lock",
        content: "第二条消息",
      },
      {
        getRoomById: async () => createRoom("room-recoverable-lock", [buildConfig("model-a")]),
        listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: () => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => ({ content: "恢复后的回复" })),
        }),
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(recoveryResult.status).toBe("completed");
    expect(listMessagesByRoomId).toHaveBeenCalledTimes(2);
  });

  it("skips cooled-down models on later rounds so healthy models can continue replying", async () => {
    const store = createHistoryStore();
    const cooledUntil = "2099-03-30T10:20:00.000Z";
    const createAdapter = vi.fn((config: ModelRuntimeConfig) => ({
      testConnection: vi.fn(),
      generateReply: vi.fn(async () => ({ content: `${config.id} still running` })),
    }));
    const createConversationRound = vi.fn(async () => ({
      id: "round-cooldown",
      roomId: "room-cooldown",
      userMessageId: "user-3",
      userMessageSequence: 3,
      status: "RUNNING" as const,
      startedAt: new Date("2026-03-30T10:15:00.000Z"),
      finishedAt: null,
    }));
    const markConversationRoundStepRunning = vi.fn();

    const room = createRoom("room-cooldown", [buildConfig("model-a"), buildConfig("model-b"), buildConfig("model-c")]);
    room.roomModels[1] = {
      ...room.roomModels[1],
      executionState: "COOLDOWN",
      cooldownUntil: new Date(cooledUntil),
      consecutiveFailureCount: 2,
      lastFailureKind: "network",
      lastFailureMessage: "Provider timeout",
      lastFailureAt: new Date("2026-03-30T10:05:00.000Z"),
    };

    const result = await sendRoomMessage(
      {
        roomId: "room-cooldown",
        content: "继续聊",
      },
      {
        getRoomById: async () => room,
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter,
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        clearRoomModelFailure: vi.fn(),
        createConversationRound,
        markConversationRoundStepRunning,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a", "model-c"]);
    expect(result.skippedModels).toEqual([
      {
        modelId: "model-b",
        name: "model-b",
        reason: "cooldown",
        availableAt: cooledUntil,
      },
    ]);
    expect(createAdapter).toHaveBeenCalledTimes(2);
    expect(createConversationRound).toHaveBeenCalledWith({
      roomId: "room-cooldown",
      userMessageId: "user-1",
      userMessageSequence: 1,
      steps: [
        { roomModelId: "rm-1", modelId: "model-a", sortOrder: 1, status: "PENDING" },
        { roomModelId: "rm-2", modelId: "model-b", sortOrder: 2, status: "SKIPPED" },
        { roomModelId: "rm-3", modelId: "model-c", sortOrder: 3, status: "PENDING" },
      ],
    });
    expect(markConversationRoundStepRunning).toHaveBeenCalledTimes(2);
  });

  it("restores half-open probe models to healthy participation after a successful reply", async () => {
    const store = createHistoryStore();
    const clearRoomModelFailure = vi.fn();
    const createAdapter = vi.fn((config: ModelRuntimeConfig) => ({
      testConnection: vi.fn(),
      generateReply: vi.fn(async () => ({ content: `${config.id} probe recovered` })),
    }));

    const room = createRoom("room-half-open-success", [
      buildConfig("model-a"),
      buildConfig("model-b"),
      buildConfig("model-c"),
    ]);
    room.roomModels[1] = {
      ...room.roomModels[1],
      executionState: "HALF_OPEN",
      cooldownUntil: null,
      consecutiveFailureCount: 2,
      lastFailureKind: "network",
      lastFailureMessage: "Provider timeout",
      lastFailureAt: new Date("2026-03-30T09:45:00.000Z"),
    };

    const result = await sendRoomMessage(
      {
        roomId: "room-half-open-success",
        content: "恢复探测一下",
      },
      {
        getRoomById: async () => room,
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter,
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        markRoomModelInCooldown: vi.fn(async () => new Date("2026-03-30T10:10:00.000Z")),
        clearRoomModelFailure,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a", "model-b", "model-c"]);
    expect(result.skippedModels).toEqual([]);
    expect(clearRoomModelFailure).toHaveBeenCalledWith("room-half-open-success", "model-b");
    expect(createAdapter).toHaveBeenCalledTimes(3);
  });

  it("re-cools a failed half-open probe and stops the remaining models", async () => {
    const store = createHistoryStore();
    const markRoomModelInCooldown = vi.fn(async () => new Date("2026-03-30T10:30:00.000Z"));

    const room = createRoom("room-half-open-failure", [
      buildConfig("model-a"),
      buildConfig("model-b"),
      buildConfig("model-c"),
    ]);
    room.roomModels[1] = {
      ...room.roomModels[1],
      executionState: "HALF_OPEN",
      cooldownUntil: null,
      consecutiveFailureCount: 2,
      lastFailureKind: "network",
      lastFailureMessage: "Provider timeout",
      lastFailureAt: new Date("2026-03-30T09:45:00.000Z"),
    };

    const result = await sendRoomMessage(
      {
        roomId: "room-half-open-failure",
        content: "看看恢复成功没有",
      },
      {
        getRoomById: async () => room,
        listMessagesByRoomId: store.listMessagesByRoomId,
        createUserMessage: store.createUserMessage,
        createAssistantMessage: store.createAssistantMessage,
        createAdapter: (config: ModelRuntimeConfig) => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            if (config.id === "model-b") {
              throw new Error("Provider timeout");
            }

            return { content: `${config.id} still healthy` };
          }),
        }),
        pauseModel: vi.fn(),
        recordRoomModelTimeout: vi.fn(),
        recordRoomModelFailure: vi.fn(),
        markRoomModelInCooldown,
        clearRoomModelFailure: vi.fn(),
      },
    );

    expect(result.status).toBe("partial");
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a"]);
    expect(result.skippedModels).toEqual([{ modelId: "model-c", name: "model-c", reason: "previous_failure", availableAt: null }]);
    expect(result.roundOutcomes).toEqual([
      {
        modelId: "model-a",
        modelName: "model-a",
        outcome: "replied",
      },
      {
        modelId: "model-b",
        modelName: "model-b",
        outcome: "failed",
        error: "Provider timeout",
        providerErrorKind: "network",
        providerErrorDetails: undefined,
        paused: false,
        pauseReason: undefined,
        cooldownUntil: "2026-03-30T10:30:00.000Z",
      },
    ]);
    expect(markRoomModelInCooldown).toHaveBeenCalledWith(
      "room-half-open-failure",
      "model-b",
      expect.objectContaining({
        kind: "network",
        message: "Provider timeout",
        occurredAt: expect.any(Date),
      }),
    );
  });
});
