import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMessage = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

const prismaChatRoom = vi.hoisted(() => ({
  update: vi.fn(),
  updateMany: vi.fn(),
}));

const prismaTransaction = vi.hoisted(() => ({
  chatRoom: prismaChatRoom,
  message: prismaMessage,
}));

const prismaTransactionRunner = vi.hoisted(() => vi.fn(async (callback: (transaction: typeof prismaTransaction) => unknown) => callback(prismaTransaction as never)));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: prismaTransactionRunner,
    chatRoom: prismaChatRoom,
    message: prismaMessage,
  },
}));

import { createAssistantMessage, createUserMessage } from "@/server/services/message-service";

describe("message-service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allocates user message sequence from the room counter inside a transaction", async () => {
    prismaChatRoom.update.mockResolvedValueOnce({ nextMessageSequence: 3 });

    prismaMessage.create.mockResolvedValueOnce({
      id: "message-2",
      roomId: "room-1",
      sequence: 2,
      role: "USER",
      modelId: null,
      content: "hello",
    });

    const message = await createUserMessage("room-1", "hello");

    expect(prismaTransactionRunner).toHaveBeenCalledTimes(1);
    expect(prismaChatRoom.update).toHaveBeenCalledWith({
      where: { id: "room-1" },
      data: {
        nextMessageSequence: {
          increment: 1,
        },
      },
      select: {
        nextMessageSequence: true,
      },
    });
    expect(prismaMessage.create).toHaveBeenCalledTimes(1);
    expect(prismaMessage.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        roomId: "room-1",
        sequence: 2,
      },
    });
    expect(message.sequence).toBe(2);
  });

  it("retries the room-sequence transaction when message creation still hits a unique conflict", async () => {
    prismaChatRoom.update.mockResolvedValueOnce({ nextMessageSequence: 3 }).mockResolvedValueOnce({ nextMessageSequence: 4 });
    prismaMessage.findFirst.mockResolvedValueOnce({ sequence: 2 });
    prismaChatRoom.updateMany.mockResolvedValueOnce({ count: 1 });

    prismaMessage.create.mockRejectedValueOnce({ code: "P2002" }).mockResolvedValueOnce({
      id: "message-3",
      roomId: "room-1",
      sequence: 3,
      role: "USER",
      modelId: null,
      content: "hello again",
    });

    const message = await createUserMessage("room-1", "hello again");

    expect(prismaTransactionRunner).toHaveBeenCalledTimes(3);
    expect(prismaChatRoom.update).toHaveBeenCalledTimes(2);
    expect(prismaMessage.findFirst).toHaveBeenCalledWith({
      where: { roomId: "room-1" },
      orderBy: {
        sequence: "desc",
      },
      select: {
        sequence: true,
      },
    });
    expect(prismaChatRoom.updateMany).toHaveBeenCalledWith({
      where: {
        id: "room-1",
        nextMessageSequence: {
          lt: 3,
        },
      },
      data: {
        nextMessageSequence: 3,
      },
    });
    expect(prismaMessage.create).toHaveBeenCalledTimes(2);
    expect(message.sequence).toBe(3);
  });

  it("repairs a stale room counter from historical messages before retrying the write", async () => {
    prismaChatRoom.update.mockResolvedValueOnce({ nextMessageSequence: 2 }).mockResolvedValueOnce({ nextMessageSequence: 9 });
    prismaMessage.findFirst.mockResolvedValueOnce({ sequence: 7 });
    prismaChatRoom.updateMany.mockResolvedValueOnce({ count: 1 });

    prismaMessage.create.mockRejectedValueOnce({ code: "P2002" }).mockResolvedValueOnce({
      id: "message-8",
      roomId: "room-stale",
      sequence: 8,
      role: "USER",
      modelId: null,
      content: "after repair",
    });

    const message = await createUserMessage("room-stale", "after repair");

    expect(prismaTransactionRunner).toHaveBeenCalledTimes(3);
    expect(prismaChatRoom.update).toHaveBeenCalledTimes(2);
    expect(prismaMessage.findFirst).toHaveBeenCalledWith({
      where: { roomId: "room-stale" },
      orderBy: {
        sequence: "desc",
      },
      select: {
        sequence: true,
      },
    });
    expect(prismaChatRoom.updateMany).toHaveBeenCalledWith({
      where: {
        id: "room-stale",
        nextMessageSequence: {
          lt: 8,
        },
      },
      data: {
        nextMessageSequence: 8,
      },
    });
    expect(prismaMessage.create.mock.calls[1]?.[0]).toMatchObject({
      data: {
        roomId: "room-stale",
        sequence: 8,
      },
    });
    expect(message.sequence).toBe(8);
  });

  it("preserves assistant speaker snapshots while using the room counter transaction", async () => {
    prismaChatRoom.update.mockResolvedValueOnce({ nextMessageSequence: 7 });

    prismaMessage.create.mockResolvedValueOnce({
      id: "assistant-6",
      roomId: "room-2",
      sequence: 6,
      role: "ASSISTANT",
      modelId: "model-a",
      content: "done",
      replyDurationMs: 1200,
      queueDurationMs: 640,
      providerRequestDurationMs: 980,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: 320,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: null,
      speakerName: "Model A",
      speakerProvider: "OPENAI_COMPATIBLE",
      speakerModelName: "gpt-4.1-mini",
      speakerAvatarLabel: "OA",
      speakerAvatarColor: "#10b981",
    });

    prismaMessage.update.mockResolvedValueOnce({
      id: "assistant-6",
      roomId: "room-2",
      sequence: 6,
      role: "ASSISTANT",
      modelId: "model-a",
      content: "done",
      replyDurationMs: 1200,
      queueDurationMs: 640,
      providerRequestDurationMs: 980,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: 320,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: 12,
      speakerName: "Model A",
      speakerProvider: "OPENAI_COMPATIBLE",
      speakerModelName: "gpt-4.1-mini",
      speakerAvatarLabel: "OA",
      speakerAvatarColor: "#10b981",
    });

    const message = await createAssistantMessage("room-2", "model-a", "done", 1200, {
      name: "Model A",
      provider: "OPENAI_COMPATIBLE",
      modelName: "gpt-4.1-mini",
      avatarLabel: "OA",
      avatarColor: "#10b981",
    }, {
      queueDurationMs: 640,
      providerRequestDurationMs: 980,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: 320,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: null,
    });

    expect(prismaTransactionRunner).toHaveBeenCalledTimes(1);
    expect(prismaChatRoom.update).toHaveBeenCalledWith({
      where: { id: "room-2" },
      data: {
        nextMessageSequence: {
          increment: 1,
        },
      },
      select: {
        nextMessageSequence: true,
      },
    });
    expect(prismaMessage.create).toHaveBeenCalledTimes(1);
    expect(prismaMessage.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        sequence: 6,
        queueDurationMs: 640,
        providerRequestDurationMs: 980,
        providerAttemptCount: 2,
        recoveryRequestDurationMs: 320,
        speakerName: "Model A",
        speakerModelName: "gpt-4.1-mini",
        speakerAvatarLabel: "OA",
        speakerAvatarColor: "#10b981",
      },
    });
    expect(prismaMessage.update).toHaveBeenCalledWith({
      where: { id: "assistant-6" },
      data: {
        persistenceDurationMs: expect.any(Number),
      },
    });
    expect(message.replyDurationMs).toBe(1200);
  });

  it("allocates distinct sequences when two messages are created concurrently for the same room", async () => {
    let nextMessageSequence = 1;
    let createdMessageCount = 0;

    prismaChatRoom.update.mockImplementation(async () => {
      nextMessageSequence += 1;
      return { nextMessageSequence };
    });

    prismaMessage.create.mockImplementation(async ({ data }: { data: { roomId: string; sequence: number; role: string; content: string } }) => {
      createdMessageCount += 1;
      await Promise.resolve();

      return {
        id: `message-${createdMessageCount}`,
        roomId: data.roomId,
        sequence: data.sequence,
        role: data.role,
        modelId: null,
        content: data.content,
      };
    });

    const [firstMessage, secondMessage] = await Promise.all([
      createUserMessage("room-concurrent", "first"),
      createUserMessage("room-concurrent", "second"),
    ]);

    expect(prismaTransactionRunner).toHaveBeenCalledTimes(2);
    expect(prismaChatRoom.update).toHaveBeenCalledTimes(2);
    expect(prismaMessage.create).toHaveBeenCalledTimes(2);
    expect([firstMessage.sequence, secondMessage.sequence].sort((left, right) => left - right)).toEqual([1, 2]);
    expect(prismaMessage.create.mock.calls.map((call) => call[0]?.data.sequence).sort((left, right) => left - right)).toEqual([
      1,
      2,
    ]);
  });

  it("shares the same room sequence source across concurrent user and assistant writes", async () => {
    let nextMessageSequence = 10;
    let createdMessageCount = 0;

    prismaChatRoom.update.mockImplementation(async () => {
      nextMessageSequence += 1;
      return { nextMessageSequence };
    });

    prismaMessage.create.mockImplementation(
      async ({
        data,
      }: {
        data: {
          roomId: string;
          sequence: number;
          role: "USER" | "ASSISTANT";
          content: string;
          modelId?: string;
          replyDurationMs?: number | null;
        };
      }) => {
        createdMessageCount += 1;
        await Promise.resolve();

        return {
          id: `message-${createdMessageCount}`,
          roomId: data.roomId,
          sequence: data.sequence,
          role: data.role,
          modelId: data.modelId ?? null,
          content: data.content,
          replyDurationMs: data.replyDurationMs ?? null,
          queueDurationMs: null,
          providerRequestDurationMs: null,
          providerAttemptCount: null,
          recoveryRequestDurationMs: null,
          rewriteRequestDurationMs: null,
          persistenceDurationMs: null,
          speakerName: null,
          speakerProvider: null,
          speakerModelName: null,
          speakerAvatarLabel: null,
          speakerAvatarColor: null,
        };
      },
    );

    prismaMessage.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { persistenceDurationMs: number } }) => ({
      id: where.id,
      roomId: "room-concurrent-mixed",
      sequence: 11,
      role: "ASSISTANT",
      modelId: "model-a",
      content: "assistant",
      replyDurationMs: 120,
      queueDurationMs: null,
      providerRequestDurationMs: null,
      providerAttemptCount: null,
      recoveryRequestDurationMs: null,
      rewriteRequestDurationMs: null,
      persistenceDurationMs: data.persistenceDurationMs,
      speakerName: "Model A",
      speakerProvider: "OPENAI_COMPATIBLE",
      speakerModelName: "gpt-4.1-mini",
      speakerAvatarLabel: "OA",
      speakerAvatarColor: "#10b981",
    }));

    const [userMessage, assistantMessage] = await Promise.all([
      createUserMessage("room-concurrent-mixed", "user"),
      createAssistantMessage(
        "room-concurrent-mixed",
        "model-a",
        "assistant",
        120,
        {
          name: "Model A",
          provider: "OPENAI_COMPATIBLE",
          modelName: "gpt-4.1-mini",
          avatarLabel: "OA",
          avatarColor: "#10b981",
        },
        null,
      ),
    ]);

    expect([userMessage.sequence, assistantMessage.sequence].sort((left, right) => left - right)).toEqual([10, 11]);
    expect(prismaChatRoom.update).toHaveBeenCalledTimes(2);
  });
});
