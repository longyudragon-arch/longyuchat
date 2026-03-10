import { prisma } from "@/lib/prisma";
import { ProviderType } from "@/generated/prisma/enums";

export interface CreateModelConfigInput {
  name: string;
  provider: keyof typeof ProviderType;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  enabled?: boolean;
}

export interface UpdateModelConfigInput {
  name?: string;
  provider?: keyof typeof ProviderType;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
  enabled?: boolean;
}

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function assertProvider(provider: string) {
  if (!(provider in ProviderType)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

export async function listModelConfigs() {
  const models = await prisma.modelConfig.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
  });

  return models.map(({ apiKey, ...model }) => ({
    ...model,
    hasApiKey: Boolean(apiKey),
  }));
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
      apiKey: requireNonEmpty(input.apiKey, "API key"),
      enabled: input.enabled ?? true,
    },
  });
}

export async function updateModelConfig(id: string, input: UpdateModelConfigInput) {
  const existingModel = await prisma.modelConfig.findUnique({
    where: { id },
  });

  if (!existingModel) {
    throw new Error(`Model ${id} was not found.`);
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
      apiKey: input.apiKey ? requireNonEmpty(input.apiKey, "API key") : undefined,
      enabled: input.enabled,
    },
  });
}

export async function deleteModelConfig(id: string) {
  return prisma.modelConfig.delete({
    where: { id },
  });
}

