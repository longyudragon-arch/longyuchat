import { prisma } from "@/lib/prisma";
import { MessageRole } from "@/generated/prisma/enums";
import { ApiError } from "@/server/http/api-error";

async function getNextSequence(roomId: string) {
  const lastMessage = await prisma.message.findFirst({
    where: { roomId },
    orderBy: {
      sequence: "desc",
    },
    select: {
      sequence: true,
    },
  });

  return (lastMessage?.sequence ?? 0) + 1;
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
  return prisma.message.create({
    data: {
      roomId,
      sequence: await getNextSequence(roomId),
      role: MessageRole.USER,
      content: requireContent(content),
    },
  });
}

export async function createAssistantMessage(roomId: string, modelId: string, content: string) {
  return prisma.message.create({
    data: {
      roomId,
      modelId,
      sequence: await getNextSequence(roomId),
      role: MessageRole.ASSISTANT,
      content: requireContent(content),
    },
  });
}
