import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/http/api-error";
import { sendRoomMessage } from "@/server/services/room-message-service";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import type { ChatMessage, ModelRuntimeConfig } from "@/types/chat";

function buildConfig(id: string, enabled = true) {
  return {
    id,
    name: id,
    provider: "OPENAI_COMPATIBLE" as const,
    baseUrl: "https://example.com/v1",
    modelName: `${id}-model`,
    apiKey: `${id}-key`,
    defaultReplyLength: 300,
    enabled,
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
  };
}

describe("sendRoomMessage", () => {
  it("persists the user message and runs sequential assistant replies", async () => {
    const history: Array<{
      roomId: string;
      sequence: number;
      role: "USER" | "ASSISTANT";
      content: string;
      modelId: string | null;
      createdAt: Date;
      id: string;
    }> = [];
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
        getRoomById: async () => ({
          id: "room-1",
          title: "Demo room",
          type: "GROUP",
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          updatedAt: new Date("2026-03-10T00:00:00.000Z"),
          roomModels: [
            {
              id: "rm-1",
              roomId: "room-1",
              modelId: "model-a",
              sortOrder: 1,
              model: buildConfig("model-a"),
            },
            {
              id: "rm-2",
              roomId: "room-1",
              modelId: "model-b",
              sortOrder: 2,
              model: buildConfig("model-b"),
            },
          ],
        }),
        listMessagesByRoomId: async () => [...history],
        createUserMessage: async (roomId, content) => {
          const message = {
            id: "user-1",
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
        createAssistantMessage: async (roomId, modelId, content) => {
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
        createAdapter,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.userMessage.sequence).toBe(1);
    expect(result.assistantMessages.map((message) => message.modelId)).toEqual(["model-a", "model-b"]);
    expect(seenMessages.get("model-a")).toEqual([
      {
        role: "system",
        content:
          "Reply in the same language as the latest user message. Your final answer must stay within 300 visible characters, including punctuation and spaces. If your first draft would be longer, compress and summarize it until it fits. Do not exceed the limit.",
      },
      { role: "user", content: "Start the thread", modelId: null, sequence: 1 },
      {
        role: "user",
        content:
          "You are model-a. Continue this multi-model discussion from your own perspective. The messages above may include replies from other AI models, but you should still respond with your own answer instead of staying silent. Keep it within the required character limit.",
      },
    ]);
    expect(seenMessages.get("model-b")).toEqual([
      {
        role: "system",
        content:
          "Reply in the same language as the latest user message. Your final answer must stay within 300 visible characters, including punctuation and spaces. If your first draft would be longer, compress and summarize it until it fits. Do not exceed the limit.",
      },
      { role: "user", content: "Start the thread", modelId: null, sequence: 1 },
      { role: "assistant", content: "First response", modelId: "model-a", sequence: 2 },
      {
        role: "user",
        content:
          "You are model-b. Continue this multi-model discussion from your own perspective. The messages above may include replies from other AI models, but you should still respond with your own answer instead of staying silent. Keep it within the required character limit.",
      },
    ]);
  });

  it("returns partial success after the first adapter failure", async () => {
    const history: Array<{
      roomId: string;
      sequence: number;
      role: "USER" | "ASSISTANT";
      content: string;
      modelId: string | null;
      createdAt: Date;
      id: string;
    }> = [];

    const result = await sendRoomMessage(
      {
        roomId: "room-2",
        content: "Keep going",
      },
      {
        getRoomById: async () => ({
          id: "room-2",
          title: "Failure room",
          type: "GROUP",
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          updatedAt: new Date("2026-03-10T00:00:00.000Z"),
          roomModels: [
            {
              id: "rm-1",
              roomId: "room-2",
              modelId: "model-a",
              sortOrder: 1,
              model: buildConfig("model-a"),
            },
            {
              id: "rm-2",
              roomId: "room-2",
              modelId: "model-b",
              sortOrder: 2,
              model: buildConfig("model-b"),
            },
          ],
        }),
        listMessagesByRoomId: async () => [...history],
        createUserMessage: async (roomId, content) => {
          const message = {
            id: "user-1",
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
        createAssistantMessage: async (roomId, modelId, content) => {
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
        createAdapter: (config: ModelRuntimeConfig) => ({
          testConnection: vi.fn(),
          generateReply: vi.fn(async () => {
            if (config.id === "model-b") {
              throw new Error("Provider timeout");
            }

            return { content: "First response" };
          }),
        }),
      },
    );

    expect(result.status).toBe("partial");
    expect(result.failedModelId).toBe("model-b");
    expect(result.assistantMessages).toHaveLength(1);
    expect(result.assistantMessages[0]?.modelId).toBe("model-a");
    expect(history).toHaveLength(2);
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
          getRoomById: async () => ({
            id: "room-disabled",
            title: "Disabled room",
            type: "GROUP",
            createdAt: new Date("2026-03-10T00:00:00.000Z"),
            updatedAt: new Date("2026-03-10T00:00:00.000Z"),
            roomModels: [
              {
                id: "rm-1",
                roomId: "room-disabled",
                modelId: "model-a",
                sortOrder: 1,
                model: buildConfig("model-a", false),
              },
            ],
          }),
          listMessagesByRoomId: vi.fn(),
          createUserMessage,
          createAssistantMessage,
          createAdapter: vi.fn(),
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
            id: "room-empty",
            title: "Empty room",
            type: "GROUP",
            createdAt: new Date("2026-03-10T00:00:00.000Z"),
            updatedAt: new Date("2026-03-10T00:00:00.000Z"),
            roomModels: [],
          }),
          listMessagesByRoomId: vi.fn(),
          createUserMessage: vi.fn(),
          createAssistantMessage: vi.fn(),
          createAdapter: vi.fn(),
        },
      ),
    ).rejects.toMatchObject<ApiError>({
      status: 400,
      message: "Room room-empty does not have any bound models.",
    });
  });
});
