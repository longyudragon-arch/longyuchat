import { describe, expect, it, vi } from "vitest";

import {
  buildParticipationInstruction,
  buildReplyLengthInstruction,
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
  }: {
    roomId: string;
    modelId: string;
    content: string;
  }): Promise<PersistedMessage> => ({
    roomId,
    modelId,
    content,
    role: "assistant",
    sequence: sequence++,
  });
}

describe("runSequentialConversation", () => {
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
      { role: "user", content: "How should we start?" },
      buildParticipationInstruction(buildConfig("model-a")),
    ]);
    expect(seenMessages.get("model-b")).toEqual([
      buildReplyLengthInstruction(buildConfig("model-b")),
      { role: "user", content: "How should we start?" },
      { role: "assistant", content: "First reply", modelId: "model-a", sequence: 1 },
      buildParticipationInstruction(buildConfig("model-b")),
    ]);
  });

  it("returns partial success and stops after the first failure", async () => {
    const thirdModel = {
      testConnection: vi.fn(),
      generateReply: vi.fn(async () => ({ content: "Should not run" })),
    };

    const adapters = new Map<string, ModelAdapter>([
      [
        "model-a",
        {
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => ({ content: "First reply" })),
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
    expect(result.failedModelId).toBe("model-b");
    expect(result.error).toContain("Provider timeout");
    expect(thirdModel.generateReply).not.toHaveBeenCalled();
  });
});
