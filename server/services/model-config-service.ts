import type { ModelConfig, ProviderConnection } from "@/generated/prisma/client";
import { ModelTestStatus, ProviderType } from "@/generated/prisma/enums";
import {
  getProviderDefaultAvatarColor,
  getProviderDefaultAvatarLabel,
  normalizeModelAvatarColor,
  normalizeModelAvatarLabel,
} from "@/lib/model-avatar";
import { prisma } from "@/lib/prisma";
import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";

import { ApiError } from "@/server/http/api-error";
import {
  decryptModelSecretOrPlaintext,
  encryptModelSecret,
  isModelSecretEncryptionConfigured,
} from "@/server/security/model-secret-crypto";

export interface CreateModelConfigInput {
  name: string;
  connectionId?: string;
  provider?: keyof typeof ProviderType;
  baseUrl?: string;
  modelName: string;
  avatarLabel?: string;
  avatarColor?: string;
  apiKey?: string;

  defaultReplyLength?: number;
  enabled?: boolean;
}

export interface UpdateModelConfigInput {
  connectionId?: string | null;
  name?: string;
  provider?: keyof typeof ProviderType;
  baseUrl?: string;
  modelName?: string;
  avatarLabel?: string;
  avatarColor?: string;
  apiKey?: string;
  defaultReplyLength?: number;
  enabled?: boolean;
}


interface PersistModelTestResultInput {
  status: keyof typeof ModelTestStatus;
  message: string;
  testedAt?: Date;
}

interface TestModelConnectionDependencies {
  getModelById: (id: string) => Promise<ModelConfig | null>;
  persistTestResult: (id: string, input: PersistModelTestResultInput) => Promise<ModelConfig>;
  createAdapter: typeof createModelAdapter;
}

type ProviderConnectionSnapshot = Pick<ProviderConnection, "id" | "provider" | "baseUrl" | "apiKey">;

interface CreateModelConfigDependencies {
  getConnectionById: (id: string) => Promise<ProviderConnectionSnapshot | null>;
  createModel: (input: {
    name: string;
    connectionId: string | null;
    provider: keyof typeof ProviderType;
    baseUrl: string;
    modelName: string;
    avatarLabel: string;
    avatarColor: string;
    apiKey: string;

    defaultReplyLength: number;
    enabled: boolean;
  }) => Promise<ModelConfig>;
}

interface UpdateModelConfigDependencies {
  getModelById: (id: string) => Promise<ModelConfig | null>;
  getConnectionById: (id: string) => Promise<ProviderConnectionSnapshot | null>;
  updateModel: (
    id: string,
    input: {
      name?: string;
      connectionId?: string | null;
      provider?: keyof typeof ProviderType;
      baseUrl?: string;
      modelName?: string;
      avatarLabel?: string;
      avatarColor?: string;
      apiKey?: string;

      defaultReplyLength?: number;
      enabled?: boolean;
      resetConnectionTest?: boolean;
    },
  ) => Promise<ModelConfig>;
}

interface PersistedModelCreateInput {
  name: string;
  connectionId: string | null;
  provider: keyof typeof ProviderType;
  baseUrl: string;
  modelName: string;
  avatarLabel: string;
  avatarColor: string;
  apiKey: string;
  defaultReplyLength: number;
  enabled: boolean;
}

interface PersistedModelUpdateInput {
  name?: string;
  connectionId?: string | null;
  provider?: keyof typeof ProviderType;
  baseUrl?: string;
  modelName?: string;
  avatarLabel?: string;
  avatarColor?: string;
  apiKey?: string;
  defaultReplyLength?: number;
  enabled?: boolean;
  resetConnectionTest?: boolean;
}

interface DeleteModelReferenceRoom {
  id: string;
  title: string;
  type: "SINGLE" | "GROUP";
}

interface DeleteModelConfigDependencies {
  getModelById: (id: string) => Promise<Pick<ModelConfig, "id" | "name"> | null>;
  getReferencingRooms: (modelId: string) => Promise<DeleteModelReferenceRoom[]>;
  deleteById: (id: string) => Promise<ModelConfig>;
}

const fallbackReplyLength = 300;
const maxTestMessageLength = 1200;

const defaultTestDependencies: TestModelConnectionDependencies = {
  getModelById: getModelConfigById,
  persistTestResult: persistModelTestResult,
  createAdapter: createModelAdapter,
};

const defaultCreateDependencies: CreateModelConfigDependencies = {
  getConnectionById: async (id) =>
    prisma.providerConnection.findUnique({
      where: { id },
      select: {
        id: true,
        provider: true,
        baseUrl: true,
        apiKey: true,
      },
    }),
  createModel: async (input) =>
    prisma.modelConfig.create({
      data: toPrismaModelConfigCreateData(input),
    }),
};

const defaultUpdateDependencies: UpdateModelConfigDependencies = {
  getModelById: getModelConfigById,
  getConnectionById: defaultCreateDependencies.getConnectionById,
  updateModel: async (id, input) =>
    prisma.modelConfig.update({
      where: { id },
      data: toPrismaModelConfigUpdateData(input),
    }),
};

const defaultDeleteDependencies: DeleteModelConfigDependencies = {
  getModelById: async (id) =>
    prisma.modelConfig.findUnique({
      where: { id },
      select: { id: true, name: true },
    }),
  getReferencingRooms: async (modelId) => {
    const roomModels = await prisma.chatRoomModel.findMany({
      where: { modelId },
      orderBy: { sortOrder: "asc" },
      select: {
        room: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    return roomModels.map((entry) => entry.room);
  },
  deleteById: (id) =>
    prisma.modelConfig.delete({
      where: { id },
    }),
};

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function requireProtectedApiKey(apiKey: string) {
  const normalized = requireNonEmpty(apiKey, "API key");

  try {
    if (!isModelSecretEncryptionConfigured()) {
      if (process.env.NODE_ENV === "production") {
        throw new ApiError(500, "MODEL_SECRET_ENCRYPTION_KEY must be configured in production to store model API keys.");
      }

      return normalized;
    }

    return encryptModelSecret(normalized);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      error instanceof Error ? error.message : "Failed to protect the model API key for storage.",
    );
  }
}

function assertProvider(provider: string) {
  if (!(provider in ProviderType)) {
    throw new ApiError(400, `Unsupported provider: ${provider}`);
  }
}

async function requireProviderConnection(
  connectionId: string,
  getConnectionById: (id: string) => Promise<ProviderConnectionSnapshot | null>,
) {
  const connection = await getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(404, `Provider connection ${connectionId} was not found.`);
  }

  return connection;
}

function normalizeDefaultReplyLength(value: number | undefined) {
  const nextValue = value ?? fallbackReplyLength;

  if (!Number.isInteger(nextValue) || nextValue < 50 || nextValue > 4000) {
    throw new ApiError(400, "Default reply length must be an integer between 50 and 4000.");
  }

  return nextValue;
}

function normalizeAvatarColorForProvider(provider: keyof typeof ProviderType, avatarColor?: string) {
  const normalized = normalizeModelAvatarColor(avatarColor);

  if (avatarColor !== undefined && !normalized) {
    throw new ApiError(400, "Avatar color must be a valid 6-digit hex color.");
  }

  return normalized ?? getProviderDefaultAvatarColor(provider);
}

function normalizeAvatarLabelForProvider(provider: keyof typeof ProviderType, avatarLabel?: string) {
  const normalized = normalizeModelAvatarLabel(avatarLabel);

  if (avatarLabel !== undefined && !normalized) {
    throw new ApiError(400, "Avatar label must contain at least one visible character.");
  }

  return normalized ?? getProviderDefaultAvatarLabel(provider);
}


function shouldResetConnectionTest(input: UpdateModelConfigInput) {
  return (
    input.connectionId !== undefined ||
    input.provider !== undefined ||
    input.baseUrl !== undefined ||
    input.modelName !== undefined ||
    input.apiKey !== undefined
  );
}

function normalizeTestMessage(message: string) {
  return message.trim().slice(0, maxTestMessageLength) || "Connection test failed.";
}

function toPersistedTestResultData(input: PersistModelTestResultInput) {
  return {
    lastTestStatus: ModelTestStatus[input.status],
    lastTestMessage: normalizeTestMessage(input.message),
    lastTestedAt: input.testedAt ?? new Date(),
  };
}

function toResetConnectionTestData() {
  return {
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
  };
}

export function toPrismaModelConfigCreateData(input: PersistedModelCreateInput) {
  return {
    name: input.name,
    provider: ProviderType[input.provider],
    baseUrl: input.baseUrl,
    modelName: input.modelName,
    avatarLabel: input.avatarLabel,
    avatarColor: input.avatarColor,
    apiKey: input.apiKey,
    defaultReplyLength: input.defaultReplyLength,
    enabled: input.enabled,
    ...(input.connectionId ? { connection: { connect: { id: input.connectionId } } } : {}),
    ...toResetConnectionTestData(),
  };
}

export function toPrismaModelConfigUpdateData(input: PersistedModelUpdateInput) {
  return {
    name: input.name,
    provider: input.provider ? ProviderType[input.provider] : undefined,
    baseUrl: input.baseUrl,
    modelName: input.modelName,
    avatarLabel: input.avatarLabel,
    avatarColor: input.avatarColor,
    apiKey: input.apiKey,
    defaultReplyLength: input.defaultReplyLength,
    enabled: input.enabled,
    ...(input.connectionId !== undefined
      ? {
          connection:
            input.connectionId === null ? { disconnect: true } : { connect: { id: input.connectionId } },
        }
      : {}),
    ...(input.resetConnectionTest ? toResetConnectionTestData() : {}),
  };
}

export async function listModelConfigs() {
  return prisma.modelConfig.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getModelConfigById(id: string) {
  return prisma.modelConfig.findUnique({
    where: { id },
  });
}

export async function createModelConfig(input: CreateModelConfigInput) {
  return createModelConfigWithDependencies(input, defaultCreateDependencies);
}

export async function createModelConfigWithDependencies(
  input: CreateModelConfigInput,
  dependencies: CreateModelConfigDependencies,
) {
  const name = requireNonEmpty(input.name, "Name");
  const modelName = requireNonEmpty(input.modelName, "Model name");
  const defaultReplyLength = normalizeDefaultReplyLength(input.defaultReplyLength);
  const enabled = input.enabled ?? true;

  if (input.connectionId) {
    const connection = await requireProviderConnection(input.connectionId, dependencies.getConnectionById);

    return dependencies.createModel({
      name,
      connectionId: connection.id,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      modelName,
      avatarLabel: normalizeAvatarLabelForProvider(connection.provider, input.avatarLabel),
      avatarColor: normalizeAvatarColorForProvider(connection.provider, input.avatarColor),
      apiKey: connection.apiKey,
      defaultReplyLength,
      enabled,
    });

  }

  if (!input.provider || !input.baseUrl || !input.apiKey) {
    throw new ApiError(
      400,
      "Provider, Base URL, and API key are required when the model is not linked to a provider connection.",
    );
  }

  assertProvider(input.provider);

  return dependencies.createModel({
    name,
    connectionId: null,
    provider: input.provider,
    baseUrl: requireNonEmpty(input.baseUrl, "Base URL"),
    modelName,
    avatarLabel: normalizeAvatarLabelForProvider(input.provider, input.avatarLabel),
    avatarColor: normalizeAvatarColorForProvider(input.provider, input.avatarColor),
    apiKey: requireProtectedApiKey(input.apiKey),
    defaultReplyLength,
    enabled,
  });

}

export async function updateModelConfig(id: string, input: UpdateModelConfigInput) {
  return updateModelConfigWithDependencies(id, input, defaultUpdateDependencies);
}

export async function updateModelConfigWithDependencies(
  id: string,
  input: UpdateModelConfigInput,
  dependencies: UpdateModelConfigDependencies,
) {
  const existingModel = await dependencies.getModelById(id);

  if (!existingModel) {
    throw new ApiError(404, `Model ${id} was not found.`);
  }

  if (
    existingModel.connectionId &&
    input.connectionId === undefined &&
    (input.provider !== undefined || input.baseUrl !== undefined || input.apiKey !== undefined)
  ) {
    throw new ApiError(
      400,
      `Model ${existingModel.name} is linked to a provider connection. Please update the connection or switch the model to another connection first.`,
    );
  }

  if (input.provider) {
    assertProvider(input.provider);
  }

  if (input.connectionId) {
    const connection = await requireProviderConnection(input.connectionId, dependencies.getConnectionById);

    return dependencies.updateModel(id, {
      name: input.name ? requireNonEmpty(input.name, "Name") : undefined,
      connectionId: connection.id,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      modelName: input.modelName ? requireNonEmpty(input.modelName, "Model name") : undefined,
      avatarLabel:
        input.avatarLabel !== undefined
          ? normalizeAvatarLabelForProvider(connection.provider, input.avatarLabel)
          : undefined,
      apiKey: connection.apiKey,
      defaultReplyLength:
        input.defaultReplyLength !== undefined ? normalizeDefaultReplyLength(input.defaultReplyLength) : undefined,
      enabled: input.enabled,
      resetConnectionTest: shouldResetConnectionTest(input),
    });
  }

  return dependencies.updateModel(id, {
    name: input.name ? requireNonEmpty(input.name, "Name") : undefined,
    connectionId: input.connectionId === null ? null : undefined,
    provider: input.provider,
    baseUrl: input.baseUrl ? requireNonEmpty(input.baseUrl, "Base URL") : undefined,
    modelName: input.modelName ? requireNonEmpty(input.modelName, "Model name") : undefined,
    avatarLabel:
      input.avatarLabel !== undefined
        ? normalizeAvatarLabelForProvider(input.provider ?? existingModel.provider, input.avatarLabel)
        : undefined,
    avatarColor:
      input.avatarColor !== undefined
        ? normalizeAvatarColorForProvider(input.provider ?? existingModel.provider, input.avatarColor)
        : undefined,
    apiKey: input.apiKey ? requireProtectedApiKey(input.apiKey) : undefined,
    defaultReplyLength:
      input.defaultReplyLength !== undefined ? normalizeDefaultReplyLength(input.defaultReplyLength) : undefined,
    enabled: input.enabled,
    resetConnectionTest: shouldResetConnectionTest(input),
  });

}

export async function deleteModelConfig(
  id: string,
  dependencies: DeleteModelConfigDependencies = defaultDeleteDependencies,
) {
  const model = await dependencies.getModelById(id);

  if (!model) {
    throw new ApiError(404, `Model ${id} was not found.`);
  }

  const referencingRooms = await dependencies.getReferencingRooms(id);

  if (referencingRooms.length > 0) {
    throw new ApiError(
      409,
      `Model ${model.name} is still used by ${referencingRooms.length} chat room(s).`,
      {
        modelId: id,
        modelName: model.name,
        roomCount: referencingRooms.length,
        rooms: referencingRooms.slice(0, 5),
      },
    );
  }

  return dependencies.deleteById(id);
}

export function toModelRuntimeConfig(model: ModelConfig) {
  let apiKey: string;

  try {
    apiKey = decryptModelSecretOrPlaintext(model.apiKey);
  } catch (error) {
    throw new ApiError(
      500,
      error instanceof Error ? error.message : "Failed to decrypt the stored model API key.",
    );
  }

  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    baseUrl: model.baseUrl,
    modelName: model.modelName,
    apiKey,
    defaultReplyLength: model.defaultReplyLength,
  };
}

export async function persistModelTestResult(id: string, input: PersistModelTestResultInput) {
  return prisma.modelConfig.update({
    where: { id },
    data: toPersistedTestResultData(input),
  });
}

export async function pauseModelConfig(id: string, reason: string) {
  return prisma.modelConfig.update({
    where: { id },
    data: {
      enabled: false,
      ...toPersistedTestResultData({
        status: "ERROR",
        message: reason,
        testedAt: new Date(),
      }),
    },
  });
}

export async function testModelConnectionById(

  id: string,
  dependencies: TestModelConnectionDependencies = defaultTestDependencies,
) {
  const model = await dependencies.getModelById(id);

  if (!model) {
    throw new ApiError(404, `Model ${id} was not found.`);
  }

  const runtimeConfig = toModelRuntimeConfig(model);

  try {
    const adapter = dependencies.createAdapter(runtimeConfig);
    await adapter.testConnection(runtimeConfig);

    return dependencies.persistTestResult(id, {
      status: "SUCCESS",
      message: "Connection test succeeded.",
    });
  } catch (error) {
    await dependencies.persistTestResult(id, {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Connection test failed.",
    });

    throw error;
  }
}
