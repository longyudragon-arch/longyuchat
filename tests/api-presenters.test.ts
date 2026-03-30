import { describe, expect, it } from "vitest";

import { MessageRole, ModelTestStatus, ProviderType, RoomType } from "@/generated/prisma/enums";
import {
  presentMessages,
  presentProviderConnection,
  presentProviderConnectionTemplateList,
  presentRoom,
} from "@/server/presenters/api-presenters";

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
          executionState: "COOLDOWN",
          cooldownUntil: new Date("2026-03-11T02:40:00.000Z"),
          consecutiveFailureCount: 2,
          timeoutCount: 2,
          lastFailureKind: "network",
          lastFailureMessage: "Provider timeout",
          lastFailureAt: new Date("2026-03-11T02:20:00.000Z"),
          lastSuccessAt: new Date("2026-03-11T01:50:00.000Z"),
          lastRecoveryAt: new Date("2026-03-11T01:40:00.000Z"),
          model: {
            id: "model-1",
            name: "OpenAI 主模型",
            connectionId: null,
            provider: ProviderType.OPENAI_COMPATIBLE,
            baseUrl: "https://api.openai.com/v1",
            modelName: "gpt-4.1-mini",
            avatarLabel: "OA",
            avatarColor: "#10b981",
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
          replyDurationMs: 2700,
          queueDurationMs: 1200,
          providerRequestDurationMs: 2400,
          providerAttemptCount: 1,
          recoveryRequestDurationMs: null,
          rewriteRequestDurationMs: null,
          persistenceDurationMs: 24,
          speakerName: "OpenAI 主模型",
          speakerProvider: ProviderType.OPENAI_COMPATIBLE,
          speakerModelName: "gpt-4.1-mini",
          speakerAvatarLabel: "OA",
          speakerAvatarColor: "#10b981",
          createdAt: new Date("2026-03-11T02:29:00.000Z"),
        },
      ],
      _count: {
        messages: 2,
      },
      roomModelReplyMetrics: {
        "model-1": {
          replyCount: 2,
          totalReplyDurationMs: 5400,
          averageReplyDurationMs: 2700,
          totalQueueDurationMs: 1800,
          averageQueueDurationMs: 900,
          totalProviderRequestDurationMs: 3200,
          averageProviderRequestDurationMs: 1600,
          timeoutCount: 0,
        },
      },
    });

    expect(room.messageCount).toBe(2);
    expect(room.lastMessagePreview).toEqual({
      role: MessageRole.ASSISTANT,
      content: "这是最近一条 AI 回复。",
      createdAt: new Date("2026-03-11T02:29:00.000Z"),
    });
    expect(room.roomModels[0]?.model.hasApiKey).toBe(true);
    expect(room.roomModels[0]?.model.avatarColor).toBe("#10b981");
    expect(room.roomModels[0]?.executionState).toBe("COOLDOWN");
    expect(room.roomModels[0]?.consecutiveFailureCount).toBe(2);
    expect(room.roomModels[0]?.cooldownUntil).toEqual(new Date("2026-03-11T02:40:00.000Z"));
    expect(room.roomModels[0]?.lastSuccessAt).toEqual(new Date("2026-03-11T01:50:00.000Z"));
    expect(room.roomModels[0]?.lastRecoveryAt).toEqual(new Date("2026-03-11T01:40:00.000Z"));
    expect(room.roomModels[0]?.replyMetrics).toEqual({
      replyCount: 2,
      totalReplyDurationMs: 5400,
      averageReplyDurationMs: 2700,
      totalQueueDurationMs: 1800,
      averageQueueDurationMs: 900,
      totalProviderRequestDurationMs: 3200,
      averageProviderRequestDurationMs: 1600,
      timeoutCount: 2,
    });
    expect(room.roomModels[0]?.lastFailure).toEqual({
      kind: "network",
      message: "Provider timeout",
      occurredAt: new Date("2026-03-11T02:20:00.000Z"),
    });
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
      roomModelReplyMetrics: {},
    });

    expect(room.messageCount).toBe(0);
    expect(room.lastMessagePreview).toBeNull();
  });
});

describe("presentMessages", () => {
  it("includes a safe model snapshot for assistant messages", () => {
    const messages = presentMessages([
      {
        id: "message-1",
        roomId: "room-1",
        sequence: 1,
        role: MessageRole.ASSISTANT,
        modelId: "model-1",
        content: "你好，我来补充一下。",
        replyDurationMs: 3200,
        queueDurationMs: 900,
        providerRequestDurationMs: 2800,
        providerAttemptCount: 2,
        recoveryRequestDurationMs: 700,
        rewriteRequestDurationMs: null,
        persistenceDurationMs: 26,
        speakerName: null,
        speakerProvider: null,
        speakerModelName: null,
        speakerAvatarLabel: null,
        speakerAvatarColor: null,
        createdAt: new Date("2026-03-11T02:40:00.000Z"),
        model: {
          id: "model-1",
          name: "Gemini 助手",
          connectionId: null,
          provider: ProviderType.GEMINI,
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
          modelName: "gemini-2.5-flash",
          avatarLabel: "GM",
          avatarColor: "#0ea5e9",
          apiKey: "secret-key",

          defaultReplyLength: 180,
          lastTestStatus: null,
          lastTestMessage: null,
          lastTestedAt: null,
          enabled: true,
          createdAt: new Date("2026-03-11T02:00:00.000Z"),
          updatedAt: new Date("2026-03-11T02:00:00.000Z"),
        },
      },
    ]);

    expect(messages[0]).toMatchObject({
      modelId: "model-1",
      replyDurationMs: 3200,
      replyTiming: {
        queueDurationMs: 900,
        providerRequestDurationMs: 2800,
        providerAttemptCount: 2,
        recoveryRequestDurationMs: 700,
        rewriteRequestDurationMs: null,
        persistenceDurationMs: 26,
      },
      model: {
        id: "model-1",
        name: "Gemini 助手",
        provider: ProviderType.GEMINI,
        modelName: "gemini-2.5-flash",
        avatarLabel: "GM",
        avatarColor: "#0ea5e9",
        defaultReplyLength: 180,

      },
    });
    expect(messages[0]?.model).not.toHaveProperty("apiKey");
  });

  it("falls back to persisted speaker snapshots when the related model config is missing", () => {
    const messages = presentMessages([
      {
        id: "message-2",
        roomId: "room-1",
        sequence: 2,
        role: MessageRole.ASSISTANT,
        modelId: "model-archived",
        content: "这是历史快照里的回复。",
        replyDurationMs: 1800,
        queueDurationMs: null,
        providerRequestDurationMs: null,
        providerAttemptCount: null,
        recoveryRequestDurationMs: null,
        rewriteRequestDurationMs: null,
        persistenceDurationMs: null,
        speakerName: "历史智谱助手",
        speakerProvider: ProviderType.OPENAI_COMPATIBLE,
        speakerModelName: "glm-4.6",
        speakerAvatarLabel: "ZP",
        speakerAvatarColor: "#2563eb",
        createdAt: new Date("2026-03-11T02:50:00.000Z"),
        model: null,
      },
    ]);

    expect(messages[0]).toMatchObject({
      modelId: "model-archived",
      replyDurationMs: 1800,
      replyTiming: null,
      model: {
        id: "model-archived",
        name: "历史智谱助手",
        provider: ProviderType.OPENAI_COMPATIBLE,
        modelName: "glm-4.6",
        avatarLabel: "ZP",
        avatarColor: "#2563eb",
        defaultReplyLength: 300,
      },
    });
  });
});

describe("presentProviderConnection", () => {
  it("respects discoveryStrategy when exposing automatic discovery capability", () => {
    const connection = presentProviderConnection({
      id: "connection-1",
      name: "Moonshot 手动连接",
      provider: ProviderType.OPENAI_COMPATIBLE,
      baseUrl: "https://api.moonshot.cn/v1",
      apiKey: "secret-key",
      discoveryStrategy: "MANUAL_ONLY",
      enabled: true,
      lastAuthStatus: null,
      lastAuthMessage: null,
      lastAuthCheckedAt: null,
      lastDiscoveryStatus: null,
      lastDiscoveryMessage: null,
      lastDiscoveredAt: null,
      createdAt: new Date("2026-03-25T10:00:00.000Z"),
      updatedAt: new Date("2026-03-25T10:00:00.000Z"),
      _count: {
        models: 0,
      },
    });

    expect(connection.supportsAutomaticModelDiscovery).toBe(false);
    expect(connection.hasApiKey).toBe(true);
  });
});

describe("presentProviderConnectionTemplateList", () => {
  it("exposes provider template metadata for the frontend without reshaping links", () => {
    const templates = presentProviderConnectionTemplateList([
      {
        id: "moonshot",
        category: "DOMESTIC",
        name: "Moonshot AI / Kimi",
        subtitle: "月之暗面，通常按 OpenAI 兼容方式接入",
        provider: ProviderType.OPENAI_COMPATIBLE,
        suggestedBaseUrl: "https://api.moonshot.cn/v1",
        avatarLabel: "KM",
        avatarColor: "#14b8a6",
        preferredDiscoveryStrategy: "MANUAL_ONLY",
        officialUrl: "https://platform.moonshot.cn",
        apiKeyUrl: "https://platform.moonshot.cn",
        docsUrl: "https://platform.moonshot.cn",
        note: "如果 /models 不可用，请手动填写模型 ID。",
      },
    ]);

    expect(templates).toEqual([
      expect.objectContaining({
        id: "moonshot",
        category: "DOMESTIC",
        provider: ProviderType.OPENAI_COMPATIBLE,
        preferredDiscoveryStrategy: "MANUAL_ONLY",
        officialUrl: "https://platform.moonshot.cn",
      }),
    ]);
  });
});
