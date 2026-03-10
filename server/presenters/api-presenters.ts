import type { ChatRoom, ChatRoomModel, Message, ModelConfig } from "@/generated/prisma/client";

type SafeModelConfig = Omit<
  ModelConfig,
  "apiKey" | "lastTestStatus" | "lastTestMessage" | "lastTestedAt"
> & {
  hasApiKey: boolean;
  lastConnectionTest: {
    status: "success" | "error";
    message: string;
    testedAt: Date;
  } | null;
};

type SafeRoomModel = Omit<ChatRoomModel, "model"> & {
  model: SafeModelConfig;
};

type RoomWithModels = ChatRoom & {
  roomModels: Array<ChatRoomModel & { model: ModelConfig }>;
  messages: Message[];
  _count: {
    messages: number;
  };
};

function presentLastConnectionTest(
  lastTestStatus: ModelConfig["lastTestStatus"],
  lastTestMessage: ModelConfig["lastTestMessage"],
  lastTestedAt: ModelConfig["lastTestedAt"],
) {
  if (!lastTestStatus || !lastTestMessage || !lastTestedAt) {
    return null;
  }

  return {
    status: lastTestStatus === "SUCCESS" ? "success" : "error",
    message: lastTestMessage,
    testedAt: lastTestedAt,
  } as const;
}

export function presentModelConfig(model: ModelConfig): SafeModelConfig {
  const { apiKey, lastTestStatus, lastTestMessage, lastTestedAt, ...rest } = model;

  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    lastConnectionTest: presentLastConnectionTest(lastTestStatus, lastTestMessage, lastTestedAt),
  };
}

export function presentModelConfigList(models: ModelConfig[]) {
  return models.map(presentModelConfig);
}

export function presentRoom(room: RoomWithModels) {
  const { messages, _count, ...rest } = room;
  const lastMessage = messages[0] ?? null;

  return {
    ...rest,
    messageCount: _count.messages,
    lastMessagePreview: lastMessage
      ? {
          role: lastMessage.role,
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
        }
      : null,
    roomModels: room.roomModels.map<SafeRoomModel>((roomModel) => ({
      ...roomModel,
      model: presentModelConfig(roomModel.model),
    })),
  };
}

export function presentRoomList(rooms: RoomWithModels[]) {
  return rooms.map(presentRoom);
}

export function presentMessages(messages: Message[]) {
  return messages;
}
