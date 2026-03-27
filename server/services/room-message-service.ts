import type { ChatRoom, ChatRoomModel, Message, ModelConfig } from "@/generated/prisma/client";
import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import { ApiError } from "@/server/http/api-error";
import { inferProviderErrorKindFromMessage, shouldPauseModelOnProviderErrorKind } from "@/server/http/provider-error";
import { logServerEvent } from "@/server/observability/server-logger";
import { runSequentialConversation } from "@/server/orchestrators/conversation-orchestrator";
import { getChatRoomById } from "@/server/services/chat-room-service";
import { createAssistantMessage, createUserMessage, listMessagesByRoomId } from "@/server/services/message-service";
import { pauseModelConfig, toModelRuntimeConfig } from "@/server/services/model-config-service";
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
  pauseModel: (modelId: string, reason: string) => Promise<ModelConfig>;
}

const defaultDependencies: SendRoomMessageDependencies = {
  getRoomById: getChatRoomById,
  listMessagesByRoomId,
  createUserMessage,
  createAssistantMessage,
  createAdapter: createModelAdapter,
  pauseModel: pauseModelConfig,
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

function buildPauseReason(modelName: string, error: string, providerErrorKind: string) {
  if (providerErrorKind === "quota") {
    return `Model ${modelName} was automatically paused after the provider reported quota or token exhaustion. ${error}`;
  }

  if (providerErrorKind === "authentication") {
    return `Model ${modelName} was automatically paused after the provider rejected the API key or authentication. ${error}`;
  }

  if (providerErrorKind === "not_found") {
    return `Model ${modelName} was automatically paused because the configured model ID or endpoint was not found upstream. ${error}`;
  }

  return `Model ${modelName} was automatically paused after the provider returned an unusable reply. ${error}`;
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

  const providerErrorKind = result.error
    ? (result.providerErrorKind ?? inferProviderErrorKindFromMessage(result.error))
    : undefined;

  let failedModelPaused = false;
  let failedModelPauseReason: string | undefined;

  if (result.status === "partial" && result.failedModelId && result.error && providerErrorKind) {
    const failedRoomModel = room.roomModels.find((roomModel) => roomModel.modelId === result.failedModelId);

    if (failedRoomModel && shouldPauseModelOnProviderErrorKind(providerErrorKind)) {
      failedModelPauseReason = buildPauseReason(failedRoomModel.model.name, result.error, providerErrorKind);

      try {
        await dependencies.pauseModel(result.failedModelId, failedModelPauseReason);
        failedModelPaused = true;
      } catch (pauseError) {
        logServerEvent("error", "room_message_pause_failed", {
          roomId: input.roomId,
          failedModelId: result.failedModelId,
          providerErrorKind,
          pauseReason: failedModelPauseReason,
          error: pauseError instanceof Error ? pauseError.message : "Unknown pause failure",
        });
      }
    }
  }

  return {
    roomId: input.roomId,
    status: result.status,
    userMessage,
    assistantMessages: result.messages,
    failedModelId: result.failedModelId,
    error: result.error,
    providerErrorKind,
    providerErrorDetails: result.providerErrorDetails,
    failedModelPaused,
    failedModelPauseReason,
  };
}
