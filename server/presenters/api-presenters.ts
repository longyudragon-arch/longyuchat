import type { ChatRoom, ChatRoomModel, Message, ModelConfig, ProviderConnection } from "@/generated/prisma/client";
import type { ProviderConnectionTemplateView } from "@/types/app";
import { supportsAutomaticModelDiscovery } from "@/lib/provider-catalog";

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

type ProviderConnectionWithCount = ProviderConnection & {
  _count: {
    models: number;
  };
};

type SafeProviderConnection = Omit<
  ProviderConnection,
  | "apiKey"
  | "lastAuthStatus"
  | "lastAuthMessage"
  | "lastAuthCheckedAt"
  | "lastDiscoveryStatus"
  | "lastDiscoveryMessage"
  | "lastDiscoveredAt"
> & {
  hasApiKey: boolean;
  modelCount: number;
  supportsAutomaticModelDiscovery: boolean;
  lastAuthCheck: {
    status: "success" | "error";
    message: string;
    testedAt: Date;
  } | null;
  lastDiscoveryCheck: {
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

type MessageWithModel = Message & {
  model: ModelConfig | null;
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

function presentProviderConnectionCheck(
  status: ProviderConnection["lastAuthStatus"],
  message: ProviderConnection["lastAuthMessage"],
  testedAt: ProviderConnection["lastAuthCheckedAt"],
) {
  if (!status || !message || !testedAt) {
    return null;
  }

  return {
    status: status === "SUCCESS" ? "success" : "error",
    message,
    testedAt,
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

export function presentProviderConnection(connection: ProviderConnectionWithCount): SafeProviderConnection {
  const {
    apiKey,
    lastAuthStatus,
    lastAuthMessage,
    lastAuthCheckedAt,
    lastDiscoveryStatus,
    lastDiscoveryMessage,
    lastDiscoveredAt,
    _count,
    ...rest
  } = connection;

  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    modelCount: _count.models,
    supportsAutomaticModelDiscovery:
      supportsAutomaticModelDiscovery(connection.provider) && connection.discoveryStrategy !== "MANUAL_ONLY",
    lastAuthCheck: presentProviderConnectionCheck(lastAuthStatus, lastAuthMessage, lastAuthCheckedAt),
    lastDiscoveryCheck: presentProviderConnectionCheck(lastDiscoveryStatus, lastDiscoveryMessage, lastDiscoveredAt),
  };
}

export function presentProviderConnectionList(connections: ProviderConnectionWithCount[]) {
  return connections.map(presentProviderConnection);
}

export function presentProviderConnectionTemplate(template: ProviderConnectionTemplateView) {
  return {
    ...template,
  };
}

export function presentProviderConnectionTemplateList(templates: ProviderConnectionTemplateView[]) {
  return templates.map(presentProviderConnectionTemplate);
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

function presentMessageModelSnapshot(model: ModelConfig | null) {
  if (!model) {
    return null;
  }

  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    modelName: model.modelName,
    avatarLabel: model.avatarLabel,
    avatarColor: model.avatarColor,
    defaultReplyLength: model.defaultReplyLength,

  };
}

export function presentMessages(messages: MessageWithModel[]) {
  return messages.map((message) => ({
    ...message,
    model: presentMessageModelSnapshot(message.model),
  }));
}
