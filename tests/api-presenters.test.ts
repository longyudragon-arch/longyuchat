import { describe, expect, it } from "vitest";

import { MessageRole, ModelTestStatus, ProviderType, RoomType } from "@/generated/prisma/enums";
import { presentRoom } from "@/server/presenters/api-presenters";

describe("presentRoom", () => {
  it("exposes safe room summary metadata without leaking api keys", () => {
    const room = presentRoom({
      id: "room-1",
      title: "产品讨论",
      type: RoomType.GROUP,
      createdAt: new Date("2026-03-10T10:00:00.000Z"),
      updatedAt: new Date("2026-03-11T02:30:00.000Z"),
      roomModels: [
        {
          id: "room-model-1",
          roomId: "room-1",
          modelId: "model-1",
          sortOrder: 1,
          model: {
            id: "model-1",
            name: "OpenAI 主模型",
            provider: ProviderType.OPENAI_COMPATIBLE,
            baseUrl: "https://api.openai.com/v1",
            modelName: "gpt-4.1-mini",
            apiKey: "secret-key",
            defaultReplyLength: 240,
            lastTestStatus: ModelTestStatus.SUCCESS,
            lastTestMessage: "连接成功",
            lastTestedAt: new Date("2026-03-11T02:10:00.000Z"),
            enabled: true,
            createdAt: new Date("2026-03-10T10:00:00.000Z"),
            updatedAt: new Date("2026-03-11T02:00:00.000Z"),
          },
        },
      ],
      messages: [
        {
          id: "message-2",
          roomId: "room-1",
          sequence: 2,
          role: MessageRole.ASSISTANT,
          modelId: "model-1",
          content: "这是最近一条 AI 回复。",
          createdAt: new Date("2026-03-11T02:29:00.000Z"),
        },
      ],
      _count: {
        messages: 2,
      },
    });

    expect(room.messageCount).toBe(2);
    expect(room.lastMessagePreview).toEqual({
      role: MessageRole.ASSISTANT,
      content: "这是最近一条 AI 回复。",
      createdAt: new Date("2026-03-11T02:29:00.000Z"),
    });
    expect(room.roomModels[0]?.model.hasApiKey).toBe(true);
    expect(room.roomModels[0]?.model).not.toHaveProperty("apiKey");
  });

  it("returns a null preview when the room has no messages yet", () => {
    const room = presentRoom({
      id: "room-2",
      title: "空房间",
      type: RoomType.SINGLE,
      createdAt: new Date("2026-03-11T03:00:00.000Z"),
      updatedAt: new Date("2026-03-11T03:00:00.000Z"),
      roomModels: [],
      messages: [],
      _count: {
        messages: 0,
      },
    });

    expect(room.messageCount).toBe(0);
    expect(room.lastMessagePreview).toBeNull();
  });
});
