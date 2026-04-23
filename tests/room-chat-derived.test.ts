import { describe, expect, it } from "vitest";

import {
  getActiveTimelineModel,
  getCompletedRunnableModelIds,
  getCurrentRoundProgress,
  getCoolingDownRoomModels,
  getCurrentRoundStepByRoomModelId,
  getHalfOpenRoomModels,
  getLastRoundOutcomeByModelId,
  getOrderDirty,
  getOrderedRoomModels,
  getRoomModelAlerts,
  getRunnableRoomModels,
  getSidebarHeadline,
} from "@/components/room-chat/room-chat-derived";
import type { RoomView, SendRoomMessageResult } from "@/types/app";

const baseModel = {
  connectionId: null,
  baseUrl: "https://example.com",
  avatarLabel: "GM",
  avatarColor: "#0ea5e9",
  defaultReplyLength: 300,
  createdAt: "2026-04-24T00:00:00.000Z",
  updatedAt: "2026-04-24T00:00:00.000Z",
  hasApiKey: true,
  lastConnectionTest: null,
} as const;

function buildRoomModel(
  id: string,
  provider: RoomView["roomModels"][number]["model"]["provider"],
  overrides: Partial<RoomView["roomModels"][number]> = {},
): RoomView["roomModels"][number] {
  return {
    id: `room-model-${id}`,
    roomId: "room-1",
    modelId: id,
    sortOrder: 1,
    executionState: "ACTIVE",
    cooldownUntil: null,
    consecutiveFailureCount: 0,
    lastSuccessAt: null,
    lastRecoveryAt: null,
    lastFailure: null,
    replyMetrics: {
      replyCount: 0,
      totalReplyDurationMs: 0,
      averageReplyDurationMs: null,
      totalQueueDurationMs: 0,
      averageQueueDurationMs: null,
      totalProviderRequestDurationMs: 0,
      averageProviderRequestDurationMs: null,
      timeoutCount: 0,
    },
    model: {
      id,
      name: `Model ${id}`,
      modelName: `${id}-model`,
      provider,
      enabled: true,
      ...baseModel,
    },
    ...overrides,
  };
}

function buildRoom(overrides: Partial<RoomView> = {}): RoomView {
  return {
    id: "room-1",
    title: "产品讨论",
    type: "GROUP",
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T00:00:00.000Z",
    messageCount: 0,
    lastMessagePreview: null,
    currentRound: null,
    roomModels: [
      buildRoomModel("model-a", "GEMINI", { sortOrder: 1 }),
      buildRoomModel("model-b", "OPENAI_COMPATIBLE", { sortOrder: 2 }),
      buildRoomModel("model-c", "QWEN", { sortOrder: 3 }),
    ],
    ...overrides,
  };
}

describe("room chat derived state", () => {
  it("orders room models by the draft order and detects dirty state", () => {
    const room = buildRoom();
    const ordered = getOrderedRoomModels(room, ["model-c", "model-a", "model-b"]);

    expect(ordered.map((item) => item.modelId)).toEqual(["model-c", "model-a", "model-b"]);
    expect(getOrderDirty(room, ["model-c", "model-a", "model-b"])).toBe(true);
    expect(getOrderDirty(room, room.roomModels.map((item) => item.modelId))).toBe(false);
  });

  it("splits runnable, cooling-down, and half-open models", () => {
    const ordered = [
      buildRoomModel("model-a", "GEMINI"),
      buildRoomModel("model-b", "OPENAI_COMPATIBLE", {
        executionState: "COOLDOWN",
        cooldownUntil: "2099-01-01T00:00:00.000Z",
      }),
      buildRoomModel("model-c", "QWEN", {
        executionState: "HALF_OPEN",
      }),
      buildRoomModel("model-d", "CLAUDE", {
        model: {
          ...buildRoomModel("model-d", "CLAUDE").model,
          enabled: false,
        },
      }),
    ];

    expect(getRunnableRoomModels(ordered, new Date("2026-04-24T00:00:00.000Z")).map((item) => item.modelId)).toEqual([
      "model-a",
      "model-c",
    ]);
    expect(getCoolingDownRoomModels(ordered, new Date("2026-04-24T00:00:00.000Z")).map((item) => item.modelId)).toEqual([
      "model-b",
    ]);
    expect(getHalfOpenRoomModels(ordered).map((item) => item.modelId)).toEqual(["model-c"]);
  });

  it("derives current-round progress, active timeline model, and completed model ids", () => {
    const room = buildRoom({
      currentRound: {
        id: "round-1",
        roomId: "room-1",
        userMessageId: "message-1",
        userMessageSequence: 1,
        status: "RUNNING",
        startedAt: "2026-04-24T00:00:00.000Z",
        finishedAt: null,
        steps: [
          {
            id: "step-1",
            roundId: "round-1",
            roomModelId: "room-model-model-a",
            modelId: "model-a",
            sortOrder: 1,
            status: "REPLIED",
            errorKind: null,
            errorMessage: null,
            startedAt: "2026-04-24T00:00:00.000Z",
            finishedAt: "2026-04-24T00:00:01.000Z",
            messageId: "assistant-1",
          },
          {
            id: "step-2",
            roundId: "round-1",
            roomModelId: "room-model-model-b",
            modelId: "model-b",
            sortOrder: 2,
            status: "RUNNING",
            errorKind: null,
            errorMessage: null,
            startedAt: "2026-04-24T00:00:02.000Z",
            finishedAt: null,
            messageId: null,
          },
          {
            id: "step-3",
            roundId: "round-1",
            roomModelId: "room-model-model-c",
            modelId: "model-c",
            sortOrder: 3,
            status: "SKIPPED",
            errorKind: null,
            errorMessage: null,
            startedAt: null,
            finishedAt: null,
            messageId: null,
          },
        ],
      },
    });
    const ordered = getOrderedRoomModels(room, room.roomModels.map((item) => item.modelId));
    const runnable = getRunnableRoomModels(ordered);

    expect(getCurrentRoundProgress(room.currentRound)).toEqual({
      completedCount: 1,
      totalCount: 2,
    });
    expect(getCurrentRoundStepByRoomModelId(room.currentRound).get("room-model-model-b")?.status).toBe("RUNNING");
    expect(getActiveTimelineModel({
      currentRound: room.currentRound,
      isSending: false,
      orderedRoomModels: ordered,
      pendingRound: null,
      runnableRoomModels: runnable,
    })?.id).toBe("model-b");
    expect([...getCompletedRunnableModelIds(room.currentRound, null, false)]).toEqual(["model-a"]);
  });

  it("falls back to pending-round progress and last-round headline when no live round exists", () => {
    const room = buildRoom();
    const ordered = getOrderedRoomModels(room, room.roomModels.map((item) => item.modelId));
    const runnable = getRunnableRoomModels(ordered);
    const pendingRound = {
      baselineSequence: 4,
      userSequence: 5,
      completedAssistantCount: 1,
      expectedAssistantCount: 3,
      repliedModelIds: ["model-a"],
    };
    const lastRoundResult: SendRoomMessageResult = {
      roomId: "room-1",
      status: "partial",
      roundOutcomes: [
        {
          modelId: "model-a",
          modelName: "Model model-a",
          outcome: "replied",
        },
        {
          modelId: "model-b",
          modelName: "Model model-b",
          outcome: "failed",
          error: "Provider timeout",
          providerErrorKind: "network",
        },
      ],
    };

    expect(getActiveTimelineModel({
      currentRound: null,
      isSending: true,
      orderedRoomModels: ordered,
      pendingRound,
      runnableRoomModels: runnable,
    })?.id).toBe("model-b");
    expect([...getCompletedRunnableModelIds(null, pendingRound, true)]).toEqual(["model-a"]);
    expect(getSidebarHeadline({
      activeTimelineModel: null,
      currentRound: null,
      isSending: false,
      lastRoundResult,
    })).toEqual({
      label: "最近失败",
      name: "Model model-b",
      tone: "failed",
    });
    expect(getLastRoundOutcomeByModelId(lastRoundResult).get("model-b")?.outcome).toBe("failed");
  });

  it("builds room model alerts from operational insights", () => {
    const alerts = getRoomModelAlerts([
      buildRoomModel("model-a", "GEMINI", {
        model: {
          ...buildRoomModel("model-a", "GEMINI").model,
          enabled: false,
          lastConnectionTest: {
            status: "error",
            message: "Provider quota or billing check failed with 429: token is exhausted.",
            testedAt: "2026-04-24T00:00:00.000Z",
          },
        },
      }),
      buildRoomModel("model-b", "OPENAI_COMPATIBLE"),
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      modelName: "Model model-a",
      insight: {
        shortLabel: "额度不足",
      },
    });
  });
});
