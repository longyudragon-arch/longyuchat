import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MessageRole, RoomModelExecutionState, RoomType } from "@/generated/prisma/enums";
import {
  getRoomModelCooldownBackoffMaxMultiplier,
  getRoomModelCooldownSeconds,
  getRoomModelNetworkCooldownSeconds,
} from "@/lib/runtime";
import { ApiError } from "@/server/http/api-error";

export interface CreateChatRoomInput {
  title: string;
  type: keyof typeof RoomType;
  modelIds: string[];
}

export interface UpdateChatRoomInput {
  title?: string;
}

export interface ReconfigureChatRoomInput {
  title: string;
  type: keyof typeof RoomType;
  modelIds: string[];
}

const roomInclude = {
  roomModels: {
    include: {
      model: true,
    },
    orderBy: {
      sortOrder: "asc" as const,
    },
  },
  messages: {
    orderBy: {
      sequence: "desc" as const,
    },
    take: 1,
  },
  _count: {
    select: {
      messages: true,
    },
  },
};

interface RoomModelReplyMetrics {
  replyCount: number;
  totalReplyDurationMs: number;
  averageReplyDurationMs: number | null;
  totalQueueDurationMs: number;
  averageQueueDurationMs: number | null;
  totalProviderRequestDurationMs: number;
  averageProviderRequestDurationMs: number | null;
  timeoutCount: number;
}

type RoomRecord = Prisma.ChatRoomGetPayload<{
  include: typeof roomInclude;
}> & {
  roomModelReplyMetrics?: Record<string, RoomModelReplyMetrics>;
};

function buildExpiredCooldownRoomModelWhereInput(now: Date, roomIds?: string[]) {
  const where: Prisma.ChatRoomModelWhereInput = {
    executionState: RoomModelExecutionState.COOLDOWN,
    cooldownUntil: {
      lte: now,
    },
  };

  if (roomIds && roomIds.length > 0) {
    where.roomId = {
      in: roomIds,
    };
  }

  return where;
}

export function resolveRoomModelExecutionState(
  executionState: `${RoomModelExecutionState}`,
  cooldownUntil: Date | null,
  now = new Date(),
) {
  if (
    executionState === RoomModelExecutionState.COOLDOWN &&
    cooldownUntil instanceof Date &&
    cooldownUntil.getTime() <= now.getTime()
  ) {
    return RoomModelExecutionState.HALF_OPEN;
  }

  return executionState;
}

export function buildReorderSortPlan(modelIds: string[]) {
  const offset = modelIds.length;

  return {
    temporary: modelIds.map((modelId, index) => ({
      modelId,
      sortOrder: index + 1 + offset,
    })),
    final: modelIds.map((modelId, index) => ({
      modelId,
      sortOrder: index + 1,
    })),
  };
}

function requireTitle(title: string) {
  const normalized = title.trim();

  if (!normalized) {
    throw new Error("Room title is required.");
  }

  return normalized;
}

function validateRoomType(type: string) {
  if (!(type in RoomType)) {
    throw new ApiError(400, `Unsupported room type: ${type}`);
  }
}

function validateModelCount(type: keyof typeof RoomType, modelIds: string[]) {
  if (type === "SINGLE" && modelIds.length !== 1) {
    throw new ApiError(400, "Single chat rooms must be bound to exactly one model.");
  }

  if (type === "GROUP" && modelIds.length < 2) {
    throw new ApiError(400, "Group chat rooms must include at least two models.");
  }
}

function uniqueModelIds(modelIds: string[]) {
  const ids = modelIds.filter((value) => value.trim().length > 0);
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length !== ids.length) {
    throw new ApiError(400, "Each model can only appear once in a room.");
  }

  return uniqueIds;
}

export function normalizeRoomSelection(type: keyof typeof RoomType, modelIds: string[]) {
  validateRoomType(type);

  const uniqueIds = uniqueModelIds(modelIds);
  validateModelCount(type, uniqueIds);

  return uniqueIds;
}

type RoomReplyMetricsSourceMessage = {
  roomId: string;
  modelId: string | null;
  replyDurationMs: number | null;
  queueDurationMs?: number | null;
  providerRequestDurationMs?: number | null;
};

export function buildRoomReplyMetricsMapFromMessages(messages: RoomReplyMetricsSourceMessage[]) {
  const metricsByRoom = new Map<string, Record<string, RoomModelReplyMetrics>>();
  const queueCountsByRoomModel = new Map<string, number>();
  const providerCountsByRoomModel = new Map<string, number>();

  for (const message of messages) {
    if (!message.modelId || typeof message.replyDurationMs !== "number") {
      continue;
    }

    const roomMetrics = metricsByRoom.get(message.roomId) ?? {};
    const existingMetrics = roomMetrics[message.modelId] ?? {
      replyCount: 0,
      totalReplyDurationMs: 0,
      averageReplyDurationMs: null,
      totalQueueDurationMs: 0,
      averageQueueDurationMs: null,
      totalProviderRequestDurationMs: 0,
      averageProviderRequestDurationMs: null,
      timeoutCount: 0,
    };
    const replyCount = existingMetrics.replyCount + 1;
    const totalReplyDurationMs = existingMetrics.totalReplyDurationMs + message.replyDurationMs;
    const roomModelKey = `${message.roomId}:${message.modelId}`;
    const nextTotalQueueDurationMs =
      existingMetrics.totalQueueDurationMs + (typeof message.queueDurationMs === "number" ? message.queueDurationMs : 0);
    const nextTotalProviderRequestDurationMs =
      existingMetrics.totalProviderRequestDurationMs +
      (typeof message.providerRequestDurationMs === "number" ? message.providerRequestDurationMs : 0);
    const queueCount =
      (queueCountsByRoomModel.get(roomModelKey) ?? 0) + (typeof message.queueDurationMs === "number" ? 1 : 0);
    const providerCount =
      (providerCountsByRoomModel.get(roomModelKey) ?? 0) +
      (typeof message.providerRequestDurationMs === "number" ? 1 : 0);

    queueCountsByRoomModel.set(roomModelKey, queueCount);
    providerCountsByRoomModel.set(roomModelKey, providerCount);

    roomMetrics[message.modelId] = {
      replyCount,
      totalReplyDurationMs,
      averageReplyDurationMs: totalReplyDurationMs / replyCount,
      totalQueueDurationMs: nextTotalQueueDurationMs,
      averageQueueDurationMs: queueCount > 0 ? nextTotalQueueDurationMs / queueCount : null,
      totalProviderRequestDurationMs: nextTotalProviderRequestDurationMs,
      averageProviderRequestDurationMs:
        providerCount > 0 ? nextTotalProviderRequestDurationMs / providerCount : null,
      timeoutCount: existingMetrics.timeoutCount,
    };

    metricsByRoom.set(message.roomId, roomMetrics);
  }

  return metricsByRoom;
}

async function requireEnabledModels(modelIds: string[]) {
  const models = await prisma.modelConfig.findMany({
    where: {
      id: {
        in: modelIds,
      },
      enabled: true,
    },
    select: {
      id: true,
    },
  });

  if (models.length !== modelIds.length) {
    throw new ApiError(400, "All selected models must exist and be enabled.");
  }

  return models;
}

async function buildRoomReplyMetricsMap(roomIds: string[]) {
  if (roomIds.length === 0) {
    return new Map<string, Record<string, RoomModelReplyMetrics>>();
  }

  const messages = await prisma.message.findMany({
    where: {
      roomId: {
        in: roomIds,
      },
      role: MessageRole.ASSISTANT,
      modelId: {
        not: null,
      },
      replyDurationMs: {
        not: null,
      },
    },
    select: {
      roomId: true,
      modelId: true,
      replyDurationMs: true,
      queueDurationMs: true,
      providerRequestDurationMs: true,
    },
  });

  return buildRoomReplyMetricsMapFromMessages(messages);
}

async function attachReplyMetricsToRooms(rooms: RoomRecord[]) {
  const metricsByRoom = await buildRoomReplyMetricsMap(rooms.map((room) => room.id));

  return rooms.map((room) => ({
    ...room,
    roomModelReplyMetrics: metricsByRoom.get(room.id) ?? {},
  }));
}

async function attachReplyMetricsToRoom(room: RoomRecord) {
  const [nextRoom] = await attachReplyMetricsToRooms([room]);
  return nextRoom;
}

async function attachReplyMetricsToOptionalRoom(room: RoomRecord | null) {
  if (!room) {
    return null;
  }

  return attachReplyMetricsToRoom(room);
}

async function normalizeExpiredRoomModelCooldownStates(roomIds?: string[], now = new Date()) {
  await prisma.chatRoomModel.updateMany({
    where: buildExpiredCooldownRoomModelWhereInput(now, roomIds),
    data: {
      executionState: RoomModelExecutionState.HALF_OPEN,
      cooldownUntil: null,
    },
  });
}

export async function listChatRooms() {
  await normalizeExpiredRoomModelCooldownStates();

  const rooms = await prisma.chatRoom.findMany({
    include: roomInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });

  return attachReplyMetricsToRooms(rooms);
}

export async function createChatRoom(input: CreateChatRoomInput) {
  const modelIds = normalizeRoomSelection(input.type, input.modelIds);

  await requireEnabledModels(modelIds);

  return prisma.$transaction(async (transaction) => {
    const room = await transaction.chatRoom.create({
      data: {
        title: requireTitle(input.title),
        type: RoomType[input.type],
      },
    });

    await transaction.chatRoomModel.createMany({
      data: modelIds.map((modelId, index) => ({
        roomId: room.id,
        modelId,
        sortOrder: index + 1,
      })),
    });

    const nextRoom = await transaction.chatRoom.findUniqueOrThrow({
      where: { id: room.id },
      include: roomInclude,
    });

    return attachReplyMetricsToRoom(nextRoom);
  });
}

export async function getChatRoomById(roomId: string) {
  await normalizeExpiredRoomModelCooldownStates([roomId]);

  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: roomInclude,
  });

  return attachReplyMetricsToOptionalRoom(room);
}

export async function incrementRoomModelTimeoutCount(roomId: string, modelId: string) {
  await prisma.chatRoomModel.updateMany({
    where: {
      roomId,
      modelId,
    },
    data: {
      timeoutCount: {
        increment: 1,
      },
    },
  });
}

export async function recordRoomModelFailure(
  roomId: string,
  modelId: string,
  failure: {
    kind: string;
    message: string;
    occurredAt: Date;
  },
) {
  await prisma.chatRoomModel.updateMany({
    where: {
      roomId,
      modelId,
    },
    data: {
      lastFailureKind: failure.kind,
      lastFailureMessage: failure.message,
      lastFailureAt: failure.occurredAt,
    },
  });
}

function getRoomModelCooldownBackoffMultiplier(consecutiveFailureCount: number) {
  const normalizedCount = Math.max(1, consecutiveFailureCount);
  return Math.min(2 ** (normalizedCount - 1), getRoomModelCooldownBackoffMaxMultiplier());
}

function getCooldownDurationSecondsForFailureKind(kind: string, consecutiveFailureCount: number) {
  const baseCooldownSeconds = kind === "network" ? getRoomModelNetworkCooldownSeconds() : getRoomModelCooldownSeconds();
  return baseCooldownSeconds * getRoomModelCooldownBackoffMultiplier(consecutiveFailureCount);
}

export function buildRoomModelCooldownUntil(kind: string, occurredAt: Date, consecutiveFailureCount = 1) {
  return new Date(occurredAt.getTime() + getCooldownDurationSecondsForFailureKind(kind, consecutiveFailureCount) * 1000);
}

export async function markRoomModelInCooldown(
  roomId: string,
  modelId: string,
  failure: {
    kind: string;
    message: string;
    occurredAt: Date;
  },
) {
  return prisma.$transaction(async (transaction) => {
    const roomModel = await transaction.chatRoomModel.findFirst({
      where: {
        roomId,
        modelId,
      },
      select: {
        consecutiveFailureCount: true,
      },
    });
    const nextConsecutiveFailureCount = (roomModel?.consecutiveFailureCount ?? 0) + 1;
    const cooldownUntil = buildRoomModelCooldownUntil(failure.kind, failure.occurredAt, nextConsecutiveFailureCount);

    await transaction.chatRoomModel.updateMany({
      where: {
        roomId,
        modelId,
      },
      data: {
        executionState: RoomModelExecutionState.COOLDOWN,
        cooldownUntil,
        consecutiveFailureCount: nextConsecutiveFailureCount,
        lastFailureKind: failure.kind,
        lastFailureMessage: failure.message,
        lastFailureAt: failure.occurredAt,
      },
    });

    return cooldownUntil;
  });
}

export async function clearRoomModelFailure(roomId: string, modelId: string) {
  await prisma.$transaction(async (transaction) => {
    const roomModel = await transaction.chatRoomModel.findFirst({
      where: {
        roomId,
        modelId,
      },
      select: {
        executionState: true,
        consecutiveFailureCount: true,
      },
    });
    const now = new Date();
    const shouldRecordRecovery =
      roomModel?.executionState === RoomModelExecutionState.HALF_OPEN ||
      roomModel?.executionState === RoomModelExecutionState.COOLDOWN ||
      (roomModel?.consecutiveFailureCount ?? 0) > 0;

    await transaction.chatRoomModel.updateMany({
      where: {
        roomId,
        modelId,
      },
      data: {
        executionState: RoomModelExecutionState.ACTIVE,
        cooldownUntil: null,
        consecutiveFailureCount: 0,
        lastFailureKind: null,
        lastFailureMessage: null,
        lastFailureAt: null,
        lastSuccessAt: now,
        ...(shouldRecordRecovery ? { lastRecoveryAt: now } : {}),
      },
    });
  });
}

export async function updateChatRoom(roomId: string, input: UpdateChatRoomInput) {
  const existingRoom = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true },
  });

  if (!existingRoom) {
    throw new ApiError(404, `Room ${roomId} was not found.`);
  }

  const room = await prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      title: input.title ? requireTitle(input.title) : undefined,
    },
    include: roomInclude,
  });

  return attachReplyMetricsToRoom(room);
}

export async function deleteChatRoom(roomId: string) {
  return prisma.chatRoom.delete({
    where: { id: roomId },
  });
}

export async function reconfigureChatRoom(roomId: string, input: ReconfigureChatRoomInput) {
  const existingRoom = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true },
  });

  if (!existingRoom) {
    throw new ApiError(404, `Room ${roomId} was not found.`);
  }

  const modelIds = normalizeRoomSelection(input.type, input.modelIds);
  await requireEnabledModels(modelIds);

  return prisma.$transaction(async (transaction) => {
    await transaction.chatRoom.update({
      where: { id: roomId },
      data: {
        title: requireTitle(input.title),
        type: RoomType[input.type],
      },
    });

    await transaction.chatRoomModel.deleteMany({
      where: { roomId },
    });

    await transaction.chatRoomModel.createMany({
      data: modelIds.map((modelId, index) => ({
        roomId,
        modelId,
        sortOrder: index + 1,
      })),
    });

    const nextRoom = await transaction.chatRoom.findUniqueOrThrow({
      where: { id: roomId },
      include: roomInclude,
    });

    return attachReplyMetricsToRoom(nextRoom);
  });
}

export async function reorderChatRoomModels(roomId: string, modelIds: string[]) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: roomInclude,
  });

  if (!room) {
    throw new ApiError(404, `Room ${roomId} was not found.`);
  }

  const uniqueIds = uniqueModelIds(modelIds);
  const existingIds = room.roomModels.map((roomModel) => roomModel.modelId);
  const hasSameIds =
    uniqueIds.length === existingIds.length && uniqueIds.every((modelId) => existingIds.includes(modelId));

  if (!hasSameIds) {
    throw new ApiError(400, "Room order must contain exactly the existing room models.");
  }

  return prisma.$transaction(async (transaction) => {
    const reorderPlan = buildReorderSortPlan(uniqueIds);

    for (const step of reorderPlan.temporary) {
      await transaction.chatRoomModel.updateMany({
        where: {
          roomId,
          modelId: step.modelId,
        },
        data: {
          sortOrder: step.sortOrder,
        },
      });
    }

    for (const step of reorderPlan.final) {
      await transaction.chatRoomModel.updateMany({
        where: {
          roomId,
          modelId: step.modelId,
        },
        data: {
          sortOrder: step.sortOrder,
        },
      });
    }

    await transaction.chatRoom.update({
      where: { id: roomId },
      data: {
        updatedAt: new Date(),
      },
    });

    const nextRoom = await transaction.chatRoom.findUniqueOrThrow({
      where: { id: roomId },
      include: roomInclude,
    });

    return attachReplyMetricsToRoom(nextRoom);
  });
}
