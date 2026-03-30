import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { MessageRole } from "@/generated/prisma/enums";
import type { ProviderType } from "@/generated/prisma/enums";
import { ApiError } from "@/server/http/api-error";
import type { ReplyTimingDetails } from "@/types/chat";

export interface AssistantSpeakerSnapshotInput {
  name: string;
  provider: ProviderType;
  modelName: string;
  avatarLabel: string;
  avatarColor: string;
}

export type AssistantReplyTimingInput = ReplyTimingDetails;

const MESSAGE_SEQUENCE_RETRY_ATTEMPTS = 5;
type MessagePersistenceClient = Pick<Prisma.TransactionClient, "chatRoom" | "message">;

function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

async function allocateNextSequence(client: MessagePersistenceClient, roomId: string) {
  const room = await client.chatRoom.update({
    where: { id: roomId },
    data: {
      nextMessageSequence: {
        increment: 1,
      },
    },
    select: {
      nextMessageSequence: true,
    },
  });

  return room.nextMessageSequence - 1;
}

async function repairRoomSequenceCounter(roomId: string) {
  await prisma.$transaction(async (transaction) => {
    const latestMessage = await transaction.message.findFirst({
      where: { roomId },
      orderBy: {
        sequence: "desc",
      },
      select: {
        sequence: true,
      },
    });

    const nextMessageSequence = (latestMessage?.sequence ?? 0) + 1;

    await transaction.chatRoom.updateMany({
      where: {
        id: roomId,
        nextMessageSequence: {
          lt: nextMessageSequence,
        },
      },
      data: {
        nextMessageSequence,
      },
    });
  });
}

async function withAllocatedMessageSequence<T>(
  roomId: string,
  persistMessage: (client: MessagePersistenceClient, sequence: number) => Promise<T>,
) {
  for (let attempt = 1; attempt <= MESSAGE_SEQUENCE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const sequence = await allocateNextSequence(transaction, roomId);
        return persistMessage(transaction, sequence);
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error) && attempt < MESSAGE_SEQUENCE_RETRY_ATTEMPTS) {
        await repairRoomSequenceCounter(roomId);
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(
    409,
    `Could not allocate a message sequence for room ${roomId} after ${MESSAGE_SEQUENCE_RETRY_ATTEMPTS} attempts.`,
  );
}

function requireContent(content: string) {
  const normalized = content.trim();

  if (!normalized) {
    throw new ApiError(400, "Message content is required.");
  }

  return normalized;
}

export async function listMessagesByRoomId(roomId: string) {
  return prisma.message.findMany({
    where: { roomId },
    include: {
      model: true,
    },
    orderBy: {
      sequence: "asc",
    },
  });
}

export async function createUserMessage(roomId: string, content: string) {
  return withAllocatedMessageSequence(roomId, (transaction, sequence) =>
    transaction.message.create({
      data: {
        roomId,
        sequence,
        role: MessageRole.USER,
        content: requireContent(content),
      },
    }),
  );
}

export async function createAssistantMessage(
  roomId: string,
  modelId: string,
  content: string,
  replyDurationMs?: number | null,
  speaker?: AssistantSpeakerSnapshotInput,
  replyTiming?: AssistantReplyTimingInput | null,
) {
  const persistenceStartedAt = Date.now();
  return withAllocatedMessageSequence(roomId, async (transaction, sequence) => {
    const createdMessage = await transaction.message.create({
      data: {
        roomId,
        modelId,
        sequence,
        role: MessageRole.ASSISTANT,
        content: requireContent(content),
        replyDurationMs,
        queueDurationMs: replyTiming?.queueDurationMs,
        providerRequestDurationMs: replyTiming?.providerRequestDurationMs,
        providerAttemptCount: replyTiming?.providerAttemptCount,
        recoveryRequestDurationMs: replyTiming?.recoveryRequestDurationMs,
        rewriteRequestDurationMs: replyTiming?.rewriteRequestDurationMs,
        speakerName: speaker?.name,
        speakerProvider: speaker?.provider,
        speakerModelName: speaker?.modelName,
        speakerAvatarLabel: speaker?.avatarLabel,
        speakerAvatarColor: speaker?.avatarColor,
      },
    });

    const persistenceDurationMs = Date.now() - persistenceStartedAt;

    return transaction.message.update({
      where: { id: createdMessage.id },
      data: {
        persistenceDurationMs,
      },
    });
  });
}
