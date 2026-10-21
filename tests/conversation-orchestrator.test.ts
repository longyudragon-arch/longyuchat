import { describe, expect, it, vi } from "vitest";

import {
  buildConversationMessagesForModel,
  buildParticipantRosterInstruction,
  buildParticipationInstruction,
  buildReplyLengthInstruction,
  buildShortInputStabilityInstruction,
  runSequentialConversation,
} from "@/server/orchestrators/conversation-orchestrator";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import type { ChatMessage, ModelRuntimeConfig, PersistedMessage } from "@/types/chat";

function buildConfig(id: string): ModelRuntimeConfig {
  return {
    id,
    name: id,
    provider: "OPENAI_COMPATIBLE",
    baseUrl: "https://example.com/v1",
    modelName: `${id}-model`,
    apiKey: "test-key",
    defaultReplyLength: 300,
  };
}

function createPersistMessage(roomId: string) {
  let sequence = 1;

  return async ({
    modelId,
    content,
    replyDurationMs,
    replyTiming,
  }: {
    roomId: string;
    modelId: string;
    content: string;
    replyDurationMs: number;
    replyTiming?: PersistedMessage["replyTiming"];
  }): Promise<PersistedMessage> => ({
    id: `${modelId}-${sequence}`,
    roomId,
    modelId,
    content,
    role: "assistant",
    sequence: sequence++,
    replyDurationMs,
    replyTiming,
  });
}

describe("runSequentialConversation", () => {
  it("adds a stability instruction for ultra-short follow-up inputs", () => {
    const instruction = buildShortInputStabilityInstruction([
      { role: "user", content: "请先介绍一下你自己" },
      { role: "assistant", content: "好的" },
      { role: "user", content: "1" },
    ]);

    expect(instruction?.role).toBe("system");
    expect(instruction?.content).toContain("最近一条较完整的用户消息「请先介绍一下你自己」");
  });

  it("preserves reply order and forwards earlier replies to later models", async () => {
    const seenMessages = new Map<string, ChatMessage[]>();

    const adapters = new Map<string, ModelAdapter>([
      [
        "model-a",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async ({ messages }) => {
            seenMessages.set("model-a", [...messages]);
            return { content: "First reply" };
          }),
        },
      ],
      [
        "model-b",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async ({ messages }) => {
            seenMessages.set("model-b", [...messages]);
            return { content: "Second reply" };
          }),
        },
      ],
    ]);

    const createAdapter = vi.fn((config: ModelRuntimeConfig) => {
      const adapter = adapters.get(config.id);

      if (!adapter) {
        throw new Error(`Missing adapter for ${config.id}`);
      }

      return adapter;
    });

    const result = await runSequentialConversation({
      roomId: "room-1",
      history: [{ role: "user", content: "How should we start?" }],
      models: [
        { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
        { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
      ],
      createAdapter,
      saveAssistantMessage: createPersistMessage("room-1"),
    });

    expect(result.status).toBe("completed");
    expect(result.messages.map((message) => message.modelId)).toEqual(["model-a", "model-b"]);
    expect(seenMessages.get("model-a")).toEqual([
      buildReplyLengthInstruction(buildConfig("model-a")),
      buildParticipantRosterInstruction(
        [
          { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
          { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
        ],
        { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
      ),
      { role: "user", content: "How should we start?" },
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
      { role: "user", content: "How should we start?" },
      {
        role: "system",
        content:
          "以下是房间中其他模型「model-a（model-a-model）」的参考发言，供应商为「OPENAI_COMPATIBLE」。这不是你自己的历史回复，也不代表你的身份或既有立场，请仅作为参考：\nFirst reply",
      },
      buildParticipationInstruction(buildConfig("model-b")),
    ]);
  });

  it("records per-reply duration when persisting assistant messages", async () => {
    const generateReply = vi.fn(async () => ({ content: "Timed reply" }));
    const saveAssistantMessage = vi.fn(createPersistMessage("room-timing"));
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_200).mockReturnValueOnce(3_650);

    try {
      const result = await runSequentialConversation({
        roomId: "room-timing",
        history: [{ role: "user", content: "请计时" }],
        models: [{ modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") }],
        createAdapter: () => ({
          testConnection: vi.fn(),
          generateReply,
        }),
        saveAssistantMessage,
      });

      expect(result.status).toBe("completed");
      expect(saveAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          replyDurationMs: 2450,
          replyTiming: {
            queueDurationMs: 200,
          },
        }),
      );
      expect(result.messages[0]?.replyDurationMs).toBe(2450);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("stops immediately when the first model adapter cannot be created", async () => {
    const saveAssistantMessage = vi.fn(createPersistMessage("room-partial"));

    const result = await runSequentialConversation({
      roomId: "room-partial",
      history: [{ role: "user", content: "继续往后回复" }],
      models: [
        {
          modelId: "model-a",
          sortOrder: 1,
          config: {
            ...buildConfig("model-a"),
            provider: "CLAUDE",
          },
        },
        { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
      ],
      createAdapter: (config) => {
        if (config.provider === "CLAUDE") {
          throw new Error("Provider CLAUDE is not supported in the MVP yet.");
        }

        return {
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => ({ content: "model-b-ok" })),
        };
      },
      saveAssistantMessage,
    });

    expect(result.status).toBe("partial");
    expect(result.roundOutcomes).toEqual([
      expect.objectContaining({
        modelId: "model-a",
        outcome: "failed",
        error: "Provider CLAUDE is not supported in the MVP yet.",
      }),
    ]);
    expect(result.messages).toHaveLength(0);
    expect(saveAssistantMessage).not.toHaveBeenCalled();
  });

  it("forwards adapter timing telemetry into the persisted assistant message", async () => {
    const saveAssistantMessage = vi.fn(createPersistMessage("room-telemetry"));

    const result = await runSequentialConversation({
      roomId: "room-telemetry",
      history: [{ role: "user", content: "继续拆时长" }],
      models: [{ modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") }],
      createAdapter: () => ({
        testConnection: vi.fn(),
        generateReply: vi.fn(async () => ({
          content: "已附带 telemetry",
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
      saveAssistantMessage,
    });

    expect(saveAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTiming: {
          queueDurationMs: expect.any(Number),
          providerRequestDurationMs: 980,
          providerAttemptCount: 2,
          recoveryRequestDurationMs: 320,
          rewriteRequestDurationMs: null,
          persistenceDurationMs: null,
        },
      }),
    );
    expect(result.messages[0]?.replyTiming).toEqual({
      queueDurationMs: expect.any(Number),
      providerRequestDurationMs: 980,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: 320,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: null,
    });
  });

  it("preserves the current model's own earlier replies as assistant history while labeling other models", async () => {
    const seenMessages = new Map<string, ChatMessage[]>();

    const adapters = new Map<string, ModelAdapter>([
      [
        "model-a",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async ({ messages }) => {
            seenMessages.set("model-a", [...messages]);
            return { content: "Model A follow-up" };
          }),
        },
      ],
      [
        "model-b",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async ({ messages }) => {
            seenMessages.set("model-b", [...messages]);
            return { content: "Model B follow-up" };
          }),
        },
      ],
    ]);

    await runSequentialConversation({
      roomId: "room-identity",
      history: [
        { role: "user", content: "继续讨论刚才的方案" },
        {
          role: "assistant",
          content: "我先前作为 model-a 给出的建议",
          modelId: "model-a",
          sequence: 2,
          speakerName: "model-a",
          speakerProvider: "OPENAI_COMPATIBLE",
          speakerModelName: "model-a-model",
        },
        {
          role: "assistant",
          content: "我先前作为 model-b 给出的建议",
          modelId: "model-b",
          sequence: 3,
          speakerName: "model-b",
          speakerProvider: "OPENAI_COMPATIBLE",
          speakerModelName: "model-b-model",
        },
      ],
      models: [
        { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
        { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
      ],
      createAdapter: (config) => {
        const adapter = adapters.get(config.id);

        if (!adapter) {
          throw new Error(`Missing adapter for ${config.id}`);
        }

        return adapter;
      },
      saveAssistantMessage: createPersistMessage("room-identity"),
    });

    expect(seenMessages.get("model-b")).toEqual(
      expect.arrayContaining([
        {
          role: "assistant",
          content: "我先前作为 model-b 给出的建议",
        },
        {
          role: "system",
          content:
            "以下是房间中其他模型「model-a（model-a-model）」的参考发言，供应商为「OPENAI_COMPATIBLE」。这不是你自己的历史回复，也不代表你的身份或既有立场，请仅作为参考：\n我先前作为 model-a 给出的建议",
        },
      ]),
    );
  });

  it("preserves earlier replies and stops after the first model failure", async () => {
    const seenMessages = new Map<string, ChatMessage[]>();
    const thirdModel = {
      testConnection: vi.fn(),
      generateReply: vi.fn(async ({ messages }: { messages: ChatMessage[] }) => {
        seenMessages.set("model-c", [...messages]);
        return { content: "Third reply" };
      }),
    };

    const adapters = new Map<string, ModelAdapter>([
      [
        "model-a",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async ({ messages }) => {
            seenMessages.set("model-a", [...messages]);
            return { content: "First reply" };
          }),
        },
      ],
      [
        "model-b",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            throw new Error("Provider timeout");
          }),
        },
      ],
      ["model-c", thirdModel],
    ]);

    const result = await runSequentialConversation({
      roomId: "room-2",
      history: [{ role: "user", content: "Keep going" }],
      models: [
        { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
        { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
        { modelId: "model-c", sortOrder: 3, config: buildConfig("model-c") },
      ],
      createAdapter: (config) => {
        const adapter = adapters.get(config.id);

        if (!adapter) {
          throw new Error(`Missing adapter for ${config.id}`);
        }

        return adapter;
      },
      saveAssistantMessage: createPersistMessage("room-2"),
    });

    expect(result.status).toBe("partial");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.modelId).toBe("model-a");
    expect(result.roundOutcomes).toEqual([
      {
        modelId: "model-a",
        outcome: "replied",
      },
      {
        modelId: "model-b",
        outcome: "failed",
        error: "Provider timeout",
        providerErrorKind: undefined,
        providerErrorDetails: undefined,
      },
    ]);
    expect(thirdModel.generateReply).not.toHaveBeenCalled();
    expect(seenMessages.has("model-c")).toBe(false);
  });

  it("does not downgrade persistence failures into model failures", async () => {
    const thirdModel = {
      testConnection: vi.fn(),
      generateReply: vi.fn(async () => ({ content: "Should not run" })),
    };
    const persistMessage = createPersistMessage("room-persistence");

    await expect(
      runSequentialConversation({
        roomId: "room-persistence",
        history: [{ role: "user", content: "Keep going" }],
        models: [
          { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") },
          { modelId: "model-b", sortOrder: 2, config: buildConfig("model-b") },
          { modelId: "model-c", sortOrder: 3, config: buildConfig("model-c") },
        ],
        createAdapter: (config) => {
          if (config.id === "model-c") {
            return thirdModel;
          }

          return {
            testConnection: vi.fn(),
            generateReply: vi.fn(async () => ({ content: `${config.id} reply` })),
          };
        },
        saveAssistantMessage: async ({ modelId, content, replyDurationMs, replyTiming }) => {
          if (modelId === "model-b") {
            throw new Error("database unavailable");
          }

          return persistMessage({
            roomId: "room-persistence",
            modelId,
            content,
            replyDurationMs,
            replyTiming,
          });
        },
      }),
    ).rejects.toThrow("database unavailable");

    expect(thirdModel.generateReply).not.toHaveBeenCalled();
  });

  it("trims older history before the latest user turn while preserving recent round context", () => {
    const originalWindow = process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES;
    process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES = "2";

    try {
      const model = { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") };
      const messages = buildConversationMessagesForModel(
        [
          { role: "user", content: "最早的问题" },
          { role: "assistant", content: "最早的回答", modelId: "model-b", speakerName: "model-b", speakerModelName: "model-b-model" },
          { role: "user", content: "中间的问题" },
          { role: "assistant", content: "中间的回答", modelId: "model-b", speakerName: "model-b", speakerModelName: "model-b-model" },
          { role: "user", content: "保留的问题" },
          { role: "assistant", content: "保留的回答", modelId: "model-b", speakerName: "model-b", speakerModelName: "model-b-model" },
          { role: "user", content: "最新的问题" },
        ],
        [model],
        model,
      );

      expect(messages).toEqual(
        expect.arrayContaining([
          {
            role: "system",
            content: "为控制上下文长度，更早的 4 条历史消息已被省略。请优先依据以下保留下来的最近上下文继续回答。",
          },
          { role: "user", content: "保留的问题" },
          {
            role: "system",
            content:
              "以下是房间中其他模型「model-b（model-b-model）」的参考发言。这不是你自己的历史回复，也不代表你的身份或既有立场，请仅作为参考：\n保留的回答",
          },
          { role: "user", content: "最新的问题" },
        ]),
      );

      expect(messages.map((message) => message.content).join("\n")).not.toContain("最早的问题");
      expect(messages.map((message) => message.content).join("\n")).not.toContain("中间的问题");
    } finally {
      if (originalWindow === undefined) {
        delete process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES;
      } else {
        process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES = originalWindow;
      }
    }
  });

  it("uses the token budget to further trim older context even when the message-count window is large", () => {
    const originalWindow = process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES;
    const originalBudget = process.env.CONVERSATION_HISTORY_CONTEXT_TOKEN_BUDGET;

    process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES = "10";
    process.env.CONVERSATION_HISTORY_CONTEXT_TOKEN_BUDGET = "260";

    try {
      const model = { modelId: "model-a", sortOrder: 1, config: buildConfig("model-a") };
      const messages = buildConversationMessagesForModel(
        [
          { role: "user", content: "很早的背景一 ".repeat(20) },
          { role: "assistant", content: "很早的回答一 ".repeat(20), modelId: "model-b", speakerName: "model-b", speakerModelName: "model-b-model" },
          { role: "user", content: "较近的背景二" },
          { role: "assistant", content: "较近的回答二", modelId: "model-b", speakerName: "model-b", speakerModelName: "model-b-model" },
          { role: "user", content: "最新的问题" },
        ],
        [model],
        model,
      );

      const flattened = messages.map((message) => message.content).join("\n");

      expect(flattened).toContain("较近的背景二");
      expect(flattened).toContain("较近的回答二");
      expect(flattened).toContain("最新的问题");
      expect(flattened).not.toContain("很早的背景一");
      expect(flattened).not.toContain("很早的回答一");
      expect(flattened).toContain("更早的 2 条历史消息已被省略");
    } finally {
      if (originalWindow === undefined) {
        delete process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES;
      } else {
        process.env.CONVERSATION_HISTORY_WINDOW_BEFORE_LATEST_USER_MESSAGES = originalWindow;
      }

      if (originalBudget === undefined) {
        delete process.env.CONVERSATION_HISTORY_CONTEXT_TOKEN_BUDGET;
      } else {
        process.env.CONVERSATION_HISTORY_CONTEXT_TOKEN_BUDGET = originalBudget;
      }
    }
  });
});
