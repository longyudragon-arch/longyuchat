import { describe, expect, it } from "vitest";

import {
  formatFailureKindLabel,
  getProviderAccentClassName,
  getProviderMessageSurfaceClassName,
  isRoomModelCoolingDown,
  isRoomModelHalfOpen,
  isRoundStepCompleted,
} from "@/components/room-chat/room-chat-helpers";
import type { RoomView } from "@/types/app";

function buildRoomModel(
  overrides: Partial<RoomView["roomModels"][number]> = {},
): RoomView["roomModels"][number] {
  return {
    id: "room-model-1",
    roomId: "room-1",
    modelId: "model-1",
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
      id: "model-1",
      name: "Gemini Flash",
      connectionId: null,
      provider: "GEMINI",
      baseUrl: "https://example.com",
      modelName: "gemini-2.5-flash",
      avatarLabel: "GM",
      avatarColor: "#0ea5e9",
      defaultReplyLength: 300,
      enabled: true,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
      hasApiKey: true,
      lastConnectionTest: null,
    },
    ...overrides,
  };
}

function buildRoundStep(
  overrides: Partial<NonNullable<RoomView["currentRound"]>["steps"][number]> = {},
): NonNullable<RoomView["currentRound"]>["steps"][number] {
  return {
    id: "step-1",
    roundId: "round-1",
    roomModelId: "room-model-1",
    modelId: "model-1",
    sortOrder: 1,
    status: "PENDING",
    errorKind: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    messageId: null,
    ...overrides,
  };
}

describe("room chat helpers", () => {
  it("returns provider-specific surface and accent classes", () => {
    expect(getProviderMessageSurfaceClassName("GEMINI")).toContain("border-sky-200");
    expect(getProviderMessageSurfaceClassName(undefined)).toContain("border-stone-200");
    expect(getProviderAccentClassName("QWEN")).toBe("bg-indigo-500");
  });

  it("formats failure kinds with readable Chinese labels", () => {
    expect(formatFailureKindLabel("authentication")).toBe("鉴权失败");
    expect(formatFailureKindLabel("reasoning_only")).toBe("仅推理无正文");
    expect(formatFailureKindLabel("unexpected")).toBe("调用失败");
  });

  it("detects cooldown and half-open room models", () => {
    expect(
      isRoomModelCoolingDown(
        buildRoomModel({
          executionState: "COOLDOWN",
          cooldownUntil: "2099-01-01T00:00:00.000Z",
        }),
        new Date("2026-04-24T00:00:00.000Z"),
      ),
    ).toBe(true);

    expect(
      isRoomModelCoolingDown(
        buildRoomModel({
          executionState: "COOLDOWN",
          cooldownUntil: "2026-01-01T00:00:00.000Z",
        }),
        new Date("2026-04-24T00:00:00.000Z"),
      ),
    ).toBe(false);

    expect(isRoomModelHalfOpen(buildRoomModel({ executionState: "HALF_OPEN" }))).toBe(true);
    expect(isRoomModelHalfOpen(buildRoomModel({ executionState: "ACTIVE" }))).toBe(false);
  });

  it("treats replied and failed round steps as completed", () => {
    expect(isRoundStepCompleted(buildRoundStep({ status: "REPLIED" }))).toBe(true);
    expect(isRoundStepCompleted(buildRoundStep({ status: "FAILED" }))).toBe(true);
    expect(isRoundStepCompleted(buildRoundStep({ status: "RUNNING" }))).toBe(false);
  });
});
