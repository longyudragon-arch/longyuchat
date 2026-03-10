import type { ChatRoom, ChatRoomModel, Message, ModelConfig } from "@/generated/prisma/client";
import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import { ApiError } from "@/server/http/api-error";
import { runSequentialConversation } from "@/server/orchestrators/conversation-orchestrator";
import { getChatRoomById } from "@/server/services/chat-room-service";
import { createAssistantMessage, createUserMessage, listMessagesByRoomId } from "@/server/services/message-service";
import { toModelRuntimeConfig } from "@/server/services/model-config-service";
import type { ChatMessage } from "@/types/chat";

type RoomWithModels = ChatRoom & {
  roomModels: Array<ChatRoomModel & { model: ModelConfig }>;
};

interface SendRoomMessageDependencies {
  getRoomById: (roomId: string) => Promise<RoomWithModels | null>;
  listMessagesByRoomId: (roomId: string) => Promise<Message[]>;
  createUserMessage: (roomId: string, content: string) => Promise<Message>;
  createAssistantMessage: (roomId: string, modelId: string, content: string) => Promise<Message>;
  createAdapter: typeof createModelAdapter;
}

const defaultDependencies: SendRoomMessageDependencies = {
  getRoomById: getChatRoomById,
  listMessagesByRoomId,
  createUserMessage,
  createAssistantMessage,
  createAdapter: createModelAdapter,
};

function toHistoryMessage(message: Message): ChatMessage {
  return {
    role: message.role.toLowerCase() as ChatMessage["role"],
    content: message.content,
    modelId: message.modelId,
    sequence: message.sequence,
  };
}

function assertRunnableRoom(room: RoomWithModels | null, roomId: string) {
  if (!room) {
    throw new ApiError(404, `Room ${roomId} was not found.`);
  }

  if (room.roomModels.length === 0) {
    throw new ApiError(400, `Room ${roomId} does not have any bound models.`);
  }

  const disabledModel = room.roomModels.find((roomModel) => !roomModel.model.enabled);

  if (disabledModel) {
    throw new ApiError(409, `Model ${disabledModel.model.name} is disabled.`);
  }

  return room;
}

export interface SendRoomMessageInput {
  roomId: string;
  content: string;
}

export async function sendRoomMessage(
  input: SendRoomMessageInput,
  dependencies: SendRoomMessageDependencies = defaultDependencies,
) {
  const room = assertRunnableRoom(await dependencies.getRoomById(input.roomId), input.roomId);
  const userMessage = await dependencies.createUserMessage(input.roomId, input.content);
  const history = await dependencies.listMessagesByRoomId(input.roomId);

  const result = await runSequentialConversation({
    roomId: input.roomId,
    history: history.map(toHistoryMessage),
    models: room.roomModels.map((roomModel) => ({
      modelId: roomModel.modelId,
      sortOrder: roomModel.sortOrder,
      config: toModelRuntimeConfig(roomModel.model),
    })),
    createAdapter: dependencies.createAdapter,
    saveAssistantMessage: async ({ roomId, modelId, content }) => {
      const message = await dependencies.createAssistantMessage(roomId, modelId, content);

      return {
        roomId: message.roomId,
        role: message.role.toLowerCase() as ChatMessage["role"],
        content: message.content,
        modelId: message.modelId,
        sequence: message.sequence,
      };
    },
  });

  return {
    roomId: input.roomId,
    status: result.status,
    userMessage,
    assistantMessages: result.messages,
    failedModelId: result.failedModelId,
    error: result.error,
  };
}

