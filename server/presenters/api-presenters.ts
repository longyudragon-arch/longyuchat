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

type SafeRoomModel = Omit<ChatRoomModel, "model" | "lastFailureKind" | "lastFailureMessage" | "lastFailureAt"> & {
  model: SafeModelConfig;
  lastFailure: {
    kind: string;
    message: string;
    occurredAt: Date;
  } | null;
  replyMetrics: {
    replyCount: number;
    totalReplyDurationMs: number;
    averageReplyDurationMs: number | null;
    totalQueueDurationMs: number;
    averageQueueDurationMs: number | null;
    totalProviderRequestDurationMs: number;
    averageProviderRequestDurationMs: number | null;
    timeoutCount: number;
  };
};

type RoomWithModels = ChatRoom & {
  roomModels: Array<ChatRoomModel & { model: ModelConfig }>;
  messages: Message[];
  _count: {
    messages: number;
  };
  roomModelReplyMetrics?: Record<
    string,
    {
      replyCount: number;
      totalReplyDurationMs: number;
      averageReplyDurationMs: number | null;
      totalQueueDurationMs: number;
      averageQueueDurationMs: number | null;
      totalProviderRequestDurationMs: number;
      averageProviderRequestDurationMs: number | null;
      timeoutCount: number;
    }
  >;
};

type MessageWithModel = Message & {
  model: ModelConfig | null;
};

type MessageSnapshotSource = Pick<
  Message,
  | "id"
  | "modelId"
  | "speakerName"
  | "speakerProvider"
  | "speakerModelName"
  | "speakerAvatarLabel"
  | "speakerAvatarColor"
> & {
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
      lastSuccessAt: roomModel.lastSuccessAt,
      lastRecoveryAt: roomModel.lastRecoveryAt,
      lastFailure:
        roomModel.lastFailureKind && roomModel.lastFailureMessage && roomModel.lastFailureAt
          ? {
              kind: roomModel.lastFailureKind,
              message: roomModel.lastFailureMessage,
              occurredAt: roomModel.lastFailureAt,
            }
          : null,
      replyMetrics: {
        ...(room.roomModelReplyMetrics?.[roomModel.modelId] ?? {
          replyCount: 0,
          totalReplyDurationMs: 0,
          averageReplyDurationMs: null,
          totalQueueDurationMs: 0,
          averageQueueDurationMs: null,
          totalProviderRequestDurationMs: 0,
          averageProviderRequestDurationMs: null,
          timeoutCount: 0,
        }),
        timeoutCount: roomModel.timeoutCount,
      },
    })),
  };
}

export function presentRoomList(rooms: RoomWithModels[]) {
  return rooms.map(presentRoom);
}

function presentMessageModelSnapshot(message: MessageSnapshotSource) {
  const provider = message.speakerProvider ?? message.model?.provider ?? null;
  const name = message.speakerName ?? message.model?.name ?? null;
  const modelName = message.speakerModelName ?? message.model?.modelName ?? null;
  const avatarLabel = message.speakerAvatarLabel ?? message.model?.avatarLabel ?? null;
  const avatarColor = message.speakerAvatarColor ?? message.model?.avatarColor ?? null;

  if (!provider || !name || !modelName || !avatarLabel || !avatarColor) {
    return null;
  }

  return {
    id: message.modelId ?? message.model?.id ?? `snapshot:${message.id}`,
    name,
    provider,
    modelName,
    avatarLabel,
    avatarColor,
    defaultReplyLength: message.model?.defaultReplyLength ?? 300,
  };
}

export function presentMessages(messages: MessageWithModel[]) {
  return messages.map((message) => ({
    id: message.id,
    roomId: message.roomId,
    sequence: message.sequence,
    role: message.role,
    modelId: message.modelId,
    content: message.content,
    replyDurationMs: message.replyDurationMs,
    replyTiming:
      typeof message.queueDurationMs === "number" ||
      typeof message.providerRequestDurationMs === "number" ||
      typeof message.providerAttemptCount === "number" ||
      typeof message.recoveryRequestDurationMs === "number" ||
      typeof message.rewriteRequestDurationMs === "number" ||
      typeof message.persistenceDurationMs === "number"
        ? {
            queueDurationMs: message.queueDurationMs,
            providerRequestDurationMs: message.providerRequestDurationMs,
            providerAttemptCount: message.providerAttemptCount,
            recoveryRequestDurationMs: message.recoveryRequestDurationMs,
            rewriteRequestDurationMs: message.rewriteRequestDurationMs,
            persistenceDurationMs: message.persistenceDurationMs,
          }
        : null,
    createdAt: message.createdAt,
    model: presentMessageModelSnapshot(message),
  }));
}
