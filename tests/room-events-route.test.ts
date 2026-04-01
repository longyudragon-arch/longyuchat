import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getChatRoomById: vi.fn(),
  presentRoom: vi.fn((room: unknown) => room),
  listConversationRoundEventsSince: vi.fn(async () => []),
}));

vi.mock("@/server/services/chat-room-service", () => ({
  getChatRoomById: mocks.getChatRoomById,
}));

vi.mock("@/server/presenters/api-presenters", () => ({
  presentRoom: mocks.presentRoom,
}));

vi.mock("@/server/services/conversation-round-service", () => ({
  listConversationRoundEventsSince: mocks.listConversationRoundEventsSince,
}));

import { GET } from "@/app/api/rooms/[id]/events/route";

describe("GET /api/rooms/[id]/events", () => {
  beforeEach(() => {
    mocks.getChatRoomById.mockReset();
    mocks.presentRoom.mockClear();
    mocks.listConversationRoundEventsSince.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 404 when the room does not exist", async () => {
    mocks.getChatRoomById.mockResolvedValue(null);

    const response = await GET(new Request("https://example.com/api/rooms/room-1/events"), {
      params: Promise.resolve({ id: "room-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "The requested record was not found.",
    });
  });

  it("streams the initial room snapshot through SSE", async () => {
    mocks.getChatRoomById.mockResolvedValue({
      id: "room-1",
      title: "Room 1",
      type: "GROUP",
      createdAt: "2026-04-02T03:00:00.000Z",
      updatedAt: "2026-04-02T03:00:00.000Z",
      messageCount: 2,
      lastMessagePreview: null,
      currentRound: {
        id: "round-1",
        roomId: "room-1",
        userMessageId: "message-1",
        userMessageSequence: 1,
        status: "RUNNING",
        startedAt: "2026-04-02T03:00:00.000Z",
        finishedAt: null,
        steps: [],
      },
      roomModels: [],
    });

    const response = await GET(new Request("https://example.com/api/rooms/room-1/events"), {
      params: Promise.resolve({ id: "room-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.body).not.toBeNull();

    const reader = response.body!.getReader();
    const firstChunk = await reader.read();
    const chunkText = new TextDecoder().decode(firstChunk.value);

    expect(chunkText).toContain("event: room-snapshot");
    expect(chunkText).toContain('"room":{"id":"room-1"');
    expect(chunkText).toContain('"currentRound":{"id":"round-1"');
    expect(chunkText).toContain('"emittedAt"');

    await reader.cancel();
  });

  it("streams persisted round events after the initial snapshot", async () => {
    vi.useFakeTimers();
    mocks.getChatRoomById.mockResolvedValue({
      id: "room-1",
      title: "Room 1",
      type: "GROUP",
      createdAt: "2026-04-02T03:00:00.000Z",
      updatedAt: "2026-04-02T03:00:00.000Z",
      messageCount: 2,
      lastMessagePreview: null,
      currentRound: {
        id: "round-1",
        roomId: "room-1",
        userMessageId: "message-1",
        userMessageSequence: 1,
        status: "RUNNING",
        startedAt: "2026-04-02T03:00:00.000Z",
        finishedAt: null,
        steps: [],
      },
      roomModels: [],
    });
    mocks.listConversationRoundEventsSince.mockResolvedValueOnce([
      {
        streamIndex: 12,
        roomId: "room-1",
        roundId: "round-1",
        stepId: "step-1",
        roomModelId: "room-model-1",
        modelId: "model-a",
        eventType: "STEP_RUNNING",
        roundStatus: null,
        stepStatus: "RUNNING",
        messageId: null,
        errorKind: null,
        errorMessage: null,
        occurredAt: new Date("2026-04-02T03:00:01.000Z"),
      },
    ]);

    const response = await GET(new Request("https://example.com/api/rooms/room-1/events"), {
      params: Promise.resolve({ id: "room-1" }),
    });

    const reader = response.body!.getReader();
    await reader.read();
    const retryChunk = await reader.read();
    expect(new TextDecoder().decode(retryChunk.value)).toContain("retry: 1500");
    await vi.advanceTimersByTimeAsync(750);
    const eventChunk = await reader.read();
    const chunkText = new TextDecoder().decode(eventChunk.value);

    expect(chunkText).toContain("event: round-event");
    expect(chunkText).toContain("id: 12");
    expect(chunkText).toContain('"eventType":"STEP_RUNNING"');
    expect(chunkText).toContain('"modelId":"model-a"');
    expect(mocks.listConversationRoundEventsSince).toHaveBeenCalledWith("room-1", 0);

    await reader.cancel();
  });
});
