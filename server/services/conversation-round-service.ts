import type { ConversationRound, ConversationRoundEvent, ConversationRoundStep, Prisma } from "@/generated/prisma/client";
import {
  ConversationRoundEventType,
  ConversationRoundStatus,
  ConversationRoundStepStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface CreateConversationRoundInput {
  roomId: string;
  userMessageId: string;
  userMessageSequence: number;
  steps: Array<{
    roomModelId: string;
    modelId: string;
    sortOrder: number;
    status: `${ConversationRoundStepStatus}`;
  }>;
}

export interface ConversationRoundFailureInput {
  errorKind?: string;
  errorMessage?: string;
}

export type ConversationRoundWithSteps = ConversationRound & {
  steps: ConversationRoundStep[];
};

type ConversationRoundPersistenceClient = Pick<
  Prisma.TransactionClient,
  "conversationRound" | "conversationRoundStep" | "conversationRoundEvent"
>;

interface CreateConversationRoundEventInput {
  roomId: string;
  roundId: string;
  stepId?: string | null;
  roomModelId?: string | null;
  modelId?: string | null;
  eventType: `${ConversationRoundEventType}`;
  roundStatus?: `${ConversationRoundStatus}` | null;
  stepStatus?: `${ConversationRoundStepStatus}` | null;
  messageId?: string | null;
  errorKind?: string | null;
  errorMessage?: string | null;
}

function getNow() {
  return new Date();
}

function toRoundCompletionEventType(status: `${ConversationRoundStatus}`) {
  if (status === ConversationRoundStatus.COMPLETED) {
    return ConversationRoundEventType.ROUND_COMPLETED;
  }

  if (status === ConversationRoundStatus.PARTIAL) {
    return ConversationRoundEventType.ROUND_PARTIAL;
  }

  return ConversationRoundEventType.ROUND_FAILED;
}

async function createConversationRoundEvent(
  client: ConversationRoundPersistenceClient,
  input: CreateConversationRoundEventInput,
) {
  return client.conversationRoundEvent.create({
    data: {
      roomId: input.roomId,
      roundId: input.roundId,
      stepId: input.stepId ?? null,
      roomModelId: input.roomModelId ?? null,
      modelId: input.modelId ?? null,
      eventType: input.eventType,
      roundStatus: input.roundStatus ?? null,
      stepStatus: input.stepStatus ?? null,
      messageId: input.messageId ?? null,
      errorKind: input.errorKind ?? null,
      errorMessage: input.errorMessage ?? null,
      occurredAt: getNow(),
    },
  });
}

export async function createConversationRound(input: CreateConversationRoundInput) {
  return prisma.$transaction(async (transaction) => {
    const round = await transaction.conversationRound.create({
      data: {
        roomId: input.roomId,
        userMessageId: input.userMessageId,
        userMessageSequence: input.userMessageSequence,
      },
    });

    await transaction.conversationRoundStep.createMany({
      data: input.steps.map((step) => ({
        roundId: round.id,
        roomModelId: step.roomModelId,
        modelId: step.modelId,
        sortOrder: step.sortOrder,
        status: step.status,
      })),
    });

    await createConversationRoundEvent(transaction, {
      roomId: input.roomId,
      roundId: round.id,
      eventType: ConversationRoundEventType.ROUND_CREATED,
      roundStatus: ConversationRoundStatus.RUNNING,
    });

    return round;
  });
}

async function updateConversationRoundStep(
  client: ConversationRoundPersistenceClient,
  roundId: string,
  roomModelId: string,
  data: Prisma.ConversationRoundStepUncheckedUpdateInput,
) {
  return client.conversationRoundStep.update({
    where: {
      roundId_roomModelId: {
        roundId,
        roomModelId,
      },
    },
    data,
  });
}

export async function markConversationRoundStepRunning(roundId: string, roomModelId: string) {
  await prisma.$transaction(async (transaction) => {
    const step = await updateConversationRoundStep(transaction, roundId, roomModelId, {
      status: ConversationRoundStepStatus.RUNNING,
      startedAt: getNow(),
      finishedAt: null,
      errorKind: null,
      errorMessage: null,
      messageId: null,
    });

    await createConversationRoundEvent(transaction, {
      roomId: step.roundId ? (await transaction.conversationRound.findUniqueOrThrow({
        where: { id: step.roundId },
        select: { roomId: true },
      })).roomId : "",
      roundId: step.roundId,
      stepId: step.id,
      roomModelId: step.roomModelId,
      modelId: step.modelId,
      eventType: ConversationRoundEventType.STEP_RUNNING,
      stepStatus: ConversationRoundStepStatus.RUNNING,
    });
  });
}

export async function markConversationRoundStepReplied(roundId: string, roomModelId: string, messageId: string) {
  await prisma.$transaction(async (transaction) => {
    const step = await updateConversationRoundStep(transaction, roundId, roomModelId, {
      status: ConversationRoundStepStatus.REPLIED,
      finishedAt: getNow(),
      errorKind: null,
      errorMessage: null,
      messageId,
    });

    await createConversationRoundEvent(transaction, {
      roomId: (await transaction.conversationRound.findUniqueOrThrow({
        where: { id: step.roundId },
        select: { roomId: true },
      })).roomId,
      roundId: step.roundId,
      stepId: step.id,
      roomModelId: step.roomModelId,
      modelId: step.modelId,
      eventType: ConversationRoundEventType.STEP_REPLIED,
      stepStatus: ConversationRoundStepStatus.REPLIED,
      messageId,
    });
  });
}

export async function markConversationRoundStepFailed(
  roundId: string,
  roomModelId: string,
  failure: ConversationRoundFailureInput,
) {
  await prisma.$transaction(async (transaction) => {
    const step = await updateConversationRoundStep(transaction, roundId, roomModelId, {
      status: ConversationRoundStepStatus.FAILED,
      finishedAt: getNow(),
      errorKind: failure.errorKind ?? null,
      errorMessage: failure.errorMessage ?? null,
      messageId: null,
    });

    await createConversationRoundEvent(transaction, {
      roomId: (await transaction.conversationRound.findUniqueOrThrow({
        where: { id: step.roundId },
        select: { roomId: true },
      })).roomId,
      roundId: step.roundId,
      stepId: step.id,
      roomModelId: step.roomModelId,
      modelId: step.modelId,
      eventType: ConversationRoundEventType.STEP_FAILED,
      stepStatus: ConversationRoundStepStatus.FAILED,
      errorKind: failure.errorKind ?? null,
      errorMessage: failure.errorMessage ?? null,
    });
  });
}

export async function finishConversationRound(roundId: string, status: `${ConversationRoundStatus}`) {
  await prisma.$transaction(async (transaction) => {
    const round = await transaction.conversationRound.update({
      where: {
        id: roundId,
      },
      data: {
        status,
        finishedAt: getNow(),
      },
      select: {
        id: true,
        roomId: true,
      },
    });

    await createConversationRoundEvent(transaction, {
      roomId: round.roomId,
      roundId: round.id,
      eventType: toRoundCompletionEventType(status),
      roundStatus: status,
    });
  });
}

export async function markConversationRoundFailed(roundId: string) {
  await finishConversationRound(roundId, ConversationRoundStatus.FAILED);
}

export async function listRunningConversationRoundsByRoomIds(roomIds: string[]) {
  if (roomIds.length === 0) {
    return new Map<string, ConversationRoundWithSteps>();
  }

  const rounds = await prisma.conversationRound.findMany({
    where: {
      roomId: {
        in: roomIds,
      },
      status: ConversationRoundStatus.RUNNING,
    },
    include: {
      steps: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  const roundsByRoomId = new Map<string, ConversationRoundWithSteps>();

  for (const round of rounds) {
    if (!roundsByRoomId.has(round.roomId)) {
      roundsByRoomId.set(round.roomId, round);
    }
  }

  return roundsByRoomId;
}

export async function listConversationRoundEventsSince(roomId: string, afterStreamIndex = 0, limit = 100) {
  if (!roomId) {
    return [] as ConversationRoundEvent[];
  }

  return prisma.conversationRoundEvent.findMany({
    where: {
      roomId,
      streamIndex: {
        gt: afterStreamIndex,
      },
    },
    orderBy: {
      streamIndex: "asc",
    },
    take: limit,
  });
}
