import { prisma } from "@/lib/prisma";
import { RoomType } from "@/generated/prisma/enums";
import { ApiError } from "@/server/http/api-error";

export interface CreateChatRoomInput {
  title: string;
  type: keyof typeof RoomType;
  modelIds: string[];
}

export interface UpdateChatRoomInput {
  title?: string;
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

export async function listChatRooms() {
  return prisma.chatRoom.findMany({
    include: roomInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function createChatRoom(input: CreateChatRoomInput) {
  validateRoomType(input.type);

  const modelIds = uniqueModelIds(input.modelIds);
  validateModelCount(input.type, modelIds);

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

    return transaction.chatRoom.findUniqueOrThrow({
      where: { id: room.id },
      include: roomInclude,
    });
  });
}

export async function getChatRoomById(roomId: string) {
  return prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: roomInclude,
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

  return prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      title: input.title ? requireTitle(input.title) : undefined,
    },
    include: roomInclude,
  });
}

export async function deleteChatRoom(roomId: string) {
  return prisma.chatRoom.delete({
    where: { id: roomId },
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

    return transaction.chatRoom.findUniqueOrThrow({
      where: { id: roomId },
      include: roomInclude,
    });
  });
}
