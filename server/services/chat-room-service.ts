import { prisma } from "@/lib/prisma";
import { RoomType } from "@/generated/prisma/enums";

export interface CreateChatRoomInput {
  title: string;
  type: keyof typeof RoomType;
  modelIds: string[];
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
    throw new Error(`Unsupported room type: ${type}`);
  }
}

function validateModelCount(type: keyof typeof RoomType, modelIds: string[]) {
  if (type === "SINGLE" && modelIds.length !== 1) {
    throw new Error("Single chat rooms must be bound to exactly one model.");
  }

  if (type === "GROUP" && modelIds.length < 2) {
    throw new Error("Group chat rooms must include at least two models.");
  }
}

function uniqueModelIds(modelIds: string[]) {
  const ids = modelIds.filter((value) => value.trim().length > 0);
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length !== ids.length) {
    throw new Error("Each model can only appear once in a room.");
  }

  return uniqueIds;
}

export async function listChatRooms() {
  return prisma.chatRoom.findMany({
    include: {
      roomModels: {
        include: {
          model: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
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
    throw new Error("All selected models must exist and be enabled.");
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
      include: {
        roomModels: {
          include: {
            model: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });
  });
}

export async function getChatRoomById(roomId: string) {
  return prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      roomModels: {
        include: {
          model: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });
}

