import type { ModelConfig } from "@/generated/prisma/client";
import { ModelTestStatus, ProviderType } from "@/generated/prisma/enums";
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
  provider: keyof typeof ProviderType;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  defaultReplyLength?: number;
  enabled?: boolean;
}

export interface UpdateModelConfigInput {
  name?: string;
  provider?: keyof typeof ProviderType;
  baseUrl?: string;
  modelName?: string;
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

function normalizeDefaultReplyLength(value: number | undefined) {
  const nextValue = value ?? fallbackReplyLength;

  if (!Number.isInteger(nextValue) || nextValue < 50 || nextValue > 4000) {
    throw new ApiError(400, "Default reply length must be an integer between 50 and 4000.");
  }

  return nextValue;
}

function shouldResetConnectionTest(input: UpdateModelConfigInput) {
  return input.provider !== undefined || input.baseUrl !== undefined || input.modelName !== undefined || input.apiKey !== undefined;
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
  assertProvider(input.provider);

  return prisma.modelConfig.create({
    data: {
      name: requireNonEmpty(input.name, "Name"),
      provider: ProviderType[input.provider],
      baseUrl: requireNonEmpty(input.baseUrl, "Base URL"),
      modelName: requireNonEmpty(input.modelName, "Model name"),
      apiKey: requireProtectedApiKey(input.apiKey),
      defaultReplyLength: normalizeDefaultReplyLength(input.defaultReplyLength),
      enabled: input.enabled ?? true,
      ...toResetConnectionTestData(),
    },
  });
}

export async function updateModelConfig(id: string, input: UpdateModelConfigInput) {
  const existingModel = await prisma.modelConfig.findUnique({
    where: { id },
  });

  if (!existingModel) {
    throw new ApiError(404, `Model ${id} was not found.`);
  }

  if (input.provider) {
    assertProvider(input.provider);
  }

  return prisma.modelConfig.update({
    where: { id },
    data: {
      name: input.name ? requireNonEmpty(input.name, "Name") : undefined,
      provider: input.provider ? ProviderType[input.provider] : undefined,
      baseUrl: input.baseUrl ? requireNonEmpty(input.baseUrl, "Base URL") : undefined,
      modelName: input.modelName ? requireNonEmpty(input.modelName, "Model name") : undefined,
      apiKey: input.apiKey ? requireProtectedApiKey(input.apiKey) : undefined,
      defaultReplyLength:
        input.defaultReplyLength !== undefined ? normalizeDefaultReplyLength(input.defaultReplyLength) : undefined,
      enabled: input.enabled,
      ...(shouldResetConnectionTest(input) ? toResetConnectionTestData() : {}),
    },
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
