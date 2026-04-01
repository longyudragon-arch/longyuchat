import { describe, expect, it } from "vitest";

import { ApiError } from "@/server/http/api-error";
import {
  buildReorderSortPlan,
  buildRoomModelCooldownUntil,
  buildRoomReplyMetricsMapFromMessages,
  normalizeRoomSelection,
  resolveRoomModelExecutionState,
} from "@/server/services/chat-room-service";

describe("buildReorderSortPlan", () => {
  it("moves all room models to temporary slots before assigning final sort orders", () => {
    const plan = buildReorderSortPlan(["model-b", "model-a", "model-c"]);

    expect(plan.temporary).toEqual([
      { modelId: "model-b", sortOrder: 4 },
      { modelId: "model-a", sortOrder: 5 },
      { modelId: "model-c", sortOrder: 6 },
    ]);

    expect(plan.final).toEqual([
      { modelId: "model-b", sortOrder: 1 },
      { modelId: "model-a", sortOrder: 2 },
      { modelId: "model-c", sortOrder: 3 },
    ]);
  });
});

describe("normalizeRoomSelection", () => {
  it("keeps unique model ids for valid group rooms", () => {
    expect(normalizeRoomSelection("GROUP", ["model-a", "model-b"])).toEqual(["model-a", "model-b"]);
  });

  it("rejects duplicate models in the same room", () => {
    try {
      normalizeRoomSelection("GROUP", ["model-a", "model-a"]);
      throw new Error("expected normalizeRoomSelection to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toMatchObject({
        reasonCode: "room_duplicate_model_selection",
        fieldHints: ["modelIds"],
      });
    }
  });

  it("rejects single rooms with more than one model", () => {
    try {
      normalizeRoomSelection("SINGLE", ["model-a", "model-b"]);
      throw new Error("expected normalizeRoomSelection to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe("Single chat rooms must be bound to exactly one model.");
      expect((error as ApiError).details).toMatchObject({
        reasonCode: "room_single_requires_one_model",
        fieldHints: ["type", "modelIds"],
      });
    }
  });

  it("rejects group rooms with fewer than two models using structured details", () => {
    try {
      normalizeRoomSelection("GROUP", ["model-a"]);
      throw new Error("expected normalizeRoomSelection to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toMatchObject({
        reasonCode: "room_group_requires_two_models",
        fieldHints: ["type", "modelIds"],
      });
    }
  });
});

describe("buildRoomReplyMetricsMapFromMessages", () => {
  it("splits average queue time and average upstream time per room model", () => {
    const metricsByRoom = buildRoomReplyMetricsMapFromMessages([
      {
        roomId: "room-1",
        modelId: "model-a",
        replyDurationMs: 5000,
        queueDurationMs: 1200,
        providerRequestDurationMs: 3400,
      },
      {
        roomId: "room-1",
        modelId: "model-a",
        replyDurationMs: 7000,
        queueDurationMs: 800,
        providerRequestDurationMs: 4200,
      },
      {
        roomId: "room-1",
        modelId: "model-b",
        replyDurationMs: 3000,
        queueDurationMs: null,
        providerRequestDurationMs: 2500,
      },
    ]);

    expect(metricsByRoom.get("room-1")).toEqual({
      "model-a": {
        replyCount: 2,
        totalReplyDurationMs: 12000,
        averageReplyDurationMs: 6000,
        totalQueueDurationMs: 2000,
        averageQueueDurationMs: 1000,
        totalProviderRequestDurationMs: 7600,
        averageProviderRequestDurationMs: 3800,
        timeoutCount: 0,
      },
      "model-b": {
        replyCount: 1,
        totalReplyDurationMs: 3000,
        averageReplyDurationMs: 3000,
        totalQueueDurationMs: 0,
        averageQueueDurationMs: null,
        totalProviderRequestDurationMs: 2500,
        averageProviderRequestDurationMs: 2500,
        timeoutCount: 0,
      },
    });
  });
});

describe("buildRoomModelCooldownUntil", () => {
  it("uses a longer cooldown window for transient network failures", () => {
    const occurredAt = new Date("2026-03-30T10:00:00.000Z");

    expect(buildRoomModelCooldownUntil("request", occurredAt).toISOString()).toBe("2026-03-30T10:10:00.000Z");
    expect(buildRoomModelCooldownUntil("network", occurredAt).toISOString()).toBe("2026-03-30T10:15:00.000Z");
  });

  it("escalates cooldown duration as consecutive failures increase", () => {
    const occurredAt = new Date("2026-03-30T10:00:00.000Z");

    expect(buildRoomModelCooldownUntil("request", occurredAt, 1).toISOString()).toBe("2026-03-30T10:10:00.000Z");
    expect(buildRoomModelCooldownUntil("request", occurredAt, 2).toISOString()).toBe("2026-03-30T10:20:00.000Z");
    expect(buildRoomModelCooldownUntil("request", occurredAt, 3).toISOString()).toBe("2026-03-30T10:40:00.000Z");
    expect(buildRoomModelCooldownUntil("request", occurredAt, 4).toISOString()).toBe("2026-03-30T10:40:00.000Z");
  });
});

describe("resolveRoomModelExecutionState", () => {
  it("turns expired cooldown state into half-open recovery state", () => {
    expect(
      resolveRoomModelExecutionState("COOLDOWN", new Date("2026-03-30T09:59:00.000Z"), new Date("2026-03-30T10:00:00.000Z")),
    ).toBe("HALF_OPEN");
  });

  it("keeps active cooldowns and active models unchanged", () => {
    expect(
      resolveRoomModelExecutionState("COOLDOWN", new Date("2026-03-30T10:05:00.000Z"), new Date("2026-03-30T10:00:00.000Z")),
    ).toBe("COOLDOWN");
    expect(resolveRoomModelExecutionState("ACTIVE", null, new Date("2026-03-30T10:00:00.000Z"))).toBe("ACTIVE");
  });
});
