import type { ProviderConnection } from "@/generated/prisma/client";
import { ProviderConnectionCheckStatus, ProviderType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import { ApiError } from "@/server/http/api-error";
import { getDefaultDiscoveryStrategy, getProviderProbeModelName, supportsAutomaticModelDiscovery } from "@/lib/provider-catalog";
import { discoverProviderModels } from "@/server/services/model-discovery-service";
import {
  decryptModelSecretOrPlaintext,
  encryptModelSecret,
  isModelSecretEncryptionConfigured,
} from "@/server/security/model-secret-crypto";
import type { ModelRuntimeConfig } from "@/types/chat";
import type { ProviderConnectionDiscoveryStrategy } from "@/types/app";

export interface CreateProviderConnectionInput {
  name: string;
  provider: keyof typeof ProviderType;
  baseUrl: string;
  apiKey: string;
  discoveryStrategy?: ProviderConnectionDiscoveryStrategy;
  enabled?: boolean;
}

export interface UpdateProviderConnectionInput {
  name?: string;
  provider?: keyof typeof ProviderType;
  baseUrl?: string;
  apiKey?: string;
  discoveryStrategy?: ProviderConnectionDiscoveryStrategy;
  enabled?: boolean;
}

interface PersistProviderCheckInput {
  status: keyof typeof ProviderConnectionCheckStatus;
  message: string;
  checkedAt?: Date;
}

interface ReferencingModelSummary {
  id: string;
  name: string;
  enabled: boolean;
}

interface DeleteProviderConnectionDependencies {
  getConnectionById: (id: string) => Promise<Pick<ProviderConnection, "id" | "name"> | null>;
  getReferencingModels: (connectionId: string) => Promise<ReferencingModelSummary[]>;
  deleteById: (id: string) => Promise<ProviderConnection>;
}

interface TestProviderConnectionDependencies {
  getConnectionById: (id: string) => Promise<ProviderConnection | null>;
  persistAuthResult: (id: string, input: PersistProviderCheckInput) => Promise<ProviderConnection>;
  discoverProviderModels: typeof discoverProviderModels;
  createAdapter: typeof createModelAdapter;
}

interface DiscoverModelsByConnectionDependencies {
  getConnectionById: (id: string) => Promise<ProviderConnection | null>;
  persistDiscoveryResult: (id: string, input: PersistProviderCheckInput) => Promise<ProviderConnection>;
  discoverProviderModels: typeof discoverProviderModels;
}

interface UpdateProviderConnectionDependencies {
  getConnectionById: (id: string) => Promise<ProviderConnection | null>;
  updateConnectionAndLinkedModels: (
    id: string,
    input: {
      name?: string;
      provider?: keyof typeof ProviderType;
      baseUrl?: string;
      apiKey?: string;
      discoveryStrategy?: ProviderConnectionDiscoveryStrategy;
      enabled?: boolean;
      resetAuthState?: boolean;
      resetDiscoveryState?: boolean;
      syncLinkedModels?: {
        provider: keyof typeof ProviderType;
        baseUrl: string;
        apiKey: string;
      };
    },
  ) => Promise<ProviderConnection & { _count: { models: number } }>;
}

const fallbackReplyLengthForProbe = 120;
const maxCheckMessageLength = 1200;

const defaultDeleteDependencies: DeleteProviderConnectionDependencies = {
  getConnectionById: async (id) =>
    prisma.providerConnection.findUnique({
      where: { id },
      select: { id: true, name: true },
    }),
  getReferencingModels: async (connectionId) =>
    prisma.modelConfig.findMany({
      where: { connectionId },
      orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        enabled: true,
      },
    }),
  deleteById: (id) =>
    prisma.providerConnection.delete({
      where: { id },
    }),
};

const defaultTestDependencies: TestProviderConnectionDependencies = {
  getConnectionById: getProviderConnectionById,
  persistAuthResult: persistProviderConnectionAuthResult,
  discoverProviderModels,
  createAdapter: createModelAdapter,
};

const defaultDiscoverDependencies: DiscoverModelsByConnectionDependencies = {
  getConnectionById: getProviderConnectionById,
  persistDiscoveryResult: persistProviderConnectionDiscoveryResult,
  discoverProviderModels,
};

const defaultUpdateDependencies: UpdateProviderConnectionDependencies = {
  getConnectionById: async (id) =>
    prisma.providerConnection.findUnique({
      where: { id },
    }),
  updateConnectionAndLinkedModels: async (id, input) => {
    const data = {
      name: input.name,
      provider: input.provider ? ProviderType[input.provider] : undefined,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      discoveryStrategy: input.discoveryStrategy,
      enabled: input.enabled,
      ...(input.resetAuthState ? toResetAuthCheckData() : {}),
      ...(input.resetDiscoveryState ? toResetDiscoveryCheckData() : {}),
    };

    return prisma.$transaction(async (tx) => {
      const connection = await tx.providerConnection.update({
        where: { id },
        data,
      });

      if (input.syncLinkedModels) {
        await tx.modelConfig.updateMany({
          where: { connectionId: id },
          data: {
            provider: ProviderType[input.syncLinkedModels.provider],
            baseUrl: input.syncLinkedModels.baseUrl,
            apiKey: input.syncLinkedModels.apiKey,
            lastTestStatus: null,
            lastTestMessage: null,
            lastTestedAt: null,
          },
        });
      }

      const modelCount = await tx.modelConfig.count({
        where: { connectionId: id },
      });

      return {
        ...connection,
        _count: {
          models: modelCount,
        },
      };
    });
  },
};

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function assertProvider(provider: string) {
  if (!(provider in ProviderType)) {
    throw new ApiError(400, `Unsupported provider: ${provider}`, {
      reasonCode: "unsupported_provider",
      retryable: false,
      fieldHints: ["providerTemplate"],
      provider,
    });
  }
}

function requireProtectedApiKey(apiKey: string) {
  const normalized = requireNonEmpty(apiKey, "API key");

  try {
    if (!isModelSecretEncryptionConfigured()) {
      if (process.env.NODE_ENV === "production") {
        throw new ApiError(500, "MODEL_SECRET_ENCRYPTION_KEY must be configured in production to store provider API keys.");
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
      error instanceof Error ? error.message : "Failed to protect the provider API key for storage.",
    );
  }
}

export function resolveProviderConnectionDiscoveryStrategy(
  provider: keyof typeof ProviderType,
  discoveryStrategy: ProviderConnectionDiscoveryStrategy | undefined,
) {
  const nextStrategy = discoveryStrategy ?? getDefaultDiscoveryStrategy(provider);

  if (!supportsAutomaticModelDiscovery(provider) && nextStrategy !== "MANUAL_ONLY") {
    throw new ApiError(
      400,
      `Provider ${provider} does not support automatic model discovery yet. Please use MANUAL_ONLY.`,
      {
        reasonCode: "provider_discovery_unsupported",
        retryable: false,
        fieldHints: ["providerTemplate", "discoveryStrategy"],
        provider,
        discoveryStrategy: nextStrategy,
      },
    );
  }

  return nextStrategy;
}

function normalizeCheckMessage(message: string) {
  return message.trim().slice(0, maxCheckMessageLength) || "Connection check failed.";
}

function toPersistedCheckData(input: PersistProviderCheckInput) {
  return {
    status: ProviderConnectionCheckStatus[input.status],
    message: normalizeCheckMessage(input.message),
    checkedAt: input.checkedAt ?? new Date(),
  };
}

function toResetAuthCheckData() {
  return {
    lastAuthStatus: null,
    lastAuthMessage: null,
    lastAuthCheckedAt: null,
  };
}

function toResetDiscoveryCheckData() {
  return {
    lastDiscoveryStatus: null,
    lastDiscoveryMessage: null,
    lastDiscoveredAt: null,
  };
}

function shouldResetAuthState(input: UpdateProviderConnectionInput) {
  return input.provider !== undefined || input.baseUrl !== undefined || input.apiKey !== undefined;
}

function shouldResetDiscoveryState(input: UpdateProviderConnectionInput) {
  return (
    input.provider !== undefined ||
    input.baseUrl !== undefined ||
    input.apiKey !== undefined ||
    input.discoveryStrategy !== undefined
  );
}

function toProviderConnectionRuntime(connection: ProviderConnection) {
  let apiKey: string;

  try {
    apiKey = decryptModelSecretOrPlaintext(connection.apiKey);
  } catch (error) {
    throw new ApiError(
      500,
      error instanceof Error ? error.message : "Failed to decrypt the stored provider API key.",
    );
  }

  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    baseUrl: connection.baseUrl,
    apiKey,
    discoveryStrategy: connection.discoveryStrategy,
  } as const;
}

function toProbeRuntimeConfig(connection: ProviderConnection, modelName: string): ModelRuntimeConfig {
  const runtimeConnection = toProviderConnectionRuntime(connection);

  return {
    id: runtimeConnection.id,
    name: runtimeConnection.name,
    provider: runtimeConnection.provider,
    baseUrl: runtimeConnection.baseUrl,
    apiKey: runtimeConnection.apiKey,
    modelName,
    defaultReplyLength: fallbackReplyLengthForProbe,
  };
}

function resolveConnectionProbeModelName(connection: ProviderConnection, modelName?: string) {
  const explicitModelName = modelName?.trim();

  if (explicitModelName) {
    return explicitModelName;
  }

  return getProviderProbeModelName(connection.provider, connection.baseUrl);
}

export async function listProviderConnections() {
  return prisma.providerConnection.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: {
          models: true,
        },
      },
    },
  });
}

export async function getProviderConnectionById(id: string) {
  return prisma.providerConnection.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          models: true,
        },
      },
    },
  });
}

export async function createProviderConnection(input: CreateProviderConnectionInput) {
  assertProvider(input.provider);

  return prisma.providerConnection.create({
    data: {
      name: requireNonEmpty(input.name, "Name"),
      provider: ProviderType[input.provider],
      baseUrl: requireNonEmpty(input.baseUrl, "Base URL"),
      apiKey: requireProtectedApiKey(input.apiKey),
      discoveryStrategy: resolveProviderConnectionDiscoveryStrategy(input.provider, input.discoveryStrategy),
      enabled: input.enabled ?? true,
      ...toResetAuthCheckData(),
      ...toResetDiscoveryCheckData(),
    },
    include: {
      _count: {
        select: {
          models: true,
        },
      },
    },
  });
}

export async function updateProviderConnection(
  id: string,
  input: UpdateProviderConnectionInput,
  dependencies: UpdateProviderConnectionDependencies = defaultUpdateDependencies,
) {
  const existingConnection = await dependencies.getConnectionById(id);

  if (!existingConnection) {
    throw new ApiError(404, `Provider connection ${id} was not found.`, {
      reasonCode: "provider_connection_not_found",
      retryable: false,
      fieldHints: ["connectionId"],
      connectionId: id,
    });
  }

  const nextProvider = (input.provider ?? existingConnection.provider) as keyof typeof ProviderType;

  if (input.provider) {
    assertProvider(input.provider);
  }

  const nextBaseUrl = input.baseUrl ? requireNonEmpty(input.baseUrl, "Base URL") : existingConnection.baseUrl;
  const nextApiKey = input.apiKey ? requireProtectedApiKey(input.apiKey) : existingConnection.apiKey;
  const nextProviderEnum = (input.provider ?? existingConnection.provider) as keyof typeof ProviderType;
  const shouldSyncLinkedModels =
    input.provider !== undefined || input.baseUrl !== undefined || input.apiKey !== undefined;

  return dependencies.updateConnectionAndLinkedModels(id, {
    name: input.name ? requireNonEmpty(input.name, "Name") : undefined,
    provider: input.provider,
    baseUrl: input.baseUrl ? nextBaseUrl : undefined,
    apiKey: input.apiKey ? nextApiKey : undefined,
    discoveryStrategy:
      input.discoveryStrategy !== undefined || input.provider !== undefined
        ? resolveProviderConnectionDiscoveryStrategy(nextProvider, input.discoveryStrategy ?? existingConnection.discoveryStrategy)
        : undefined,
    enabled: input.enabled,
    resetAuthState: shouldResetAuthState(input),
    resetDiscoveryState: shouldResetDiscoveryState(input),
    syncLinkedModels: shouldSyncLinkedModels
      ? {
          provider: nextProviderEnum,
          baseUrl: nextBaseUrl,
          apiKey: nextApiKey,
        }
      : undefined,
  });
}

export async function deleteProviderConnection(
  id: string,
  dependencies: DeleteProviderConnectionDependencies = defaultDeleteDependencies,
) {
  const connection = await dependencies.getConnectionById(id);

  if (!connection) {
    throw new ApiError(404, `Provider connection ${id} was not found.`, {
      reasonCode: "provider_connection_not_found",
      retryable: false,
      fieldHints: ["connectionId"],
      connectionId: id,
    });
  }

  const referencingModels = await dependencies.getReferencingModels(id);

  if (referencingModels.length > 0) {
    throw new ApiError(
      409,
      `Provider connection ${connection.name} is still used by ${referencingModels.length} model(s).`,
      {
        reasonCode: "provider_connection_in_use",
        retryable: false,
        fieldHints: ["connectionId"],
        connectionId: id,
        connectionName: connection.name,
        modelCount: referencingModels.length,
        models: referencingModels.slice(0, 5),
      },
    );
  }

  return dependencies.deleteById(id);
}

export async function persistProviderConnectionAuthResult(id: string, input: PersistProviderCheckInput) {
  const payload = toPersistedCheckData(input);

  return prisma.providerConnection.update({
    where: { id },
    data: {
      lastAuthStatus: payload.status,
      lastAuthMessage: payload.message,
      lastAuthCheckedAt: payload.checkedAt,
    },
  });
}

export async function persistProviderConnectionDiscoveryResult(id: string, input: PersistProviderCheckInput) {
  const payload = toPersistedCheckData(input);

  return prisma.providerConnection.update({
    where: { id },
    data: {
      lastDiscoveryStatus: payload.status,
      lastDiscoveryMessage: payload.message,
      lastDiscoveredAt: payload.checkedAt,
    },
  });
}

export async function testProviderConnectionById(
  id: string,
  input: {
    modelName?: string;
  } = {},
  dependencies: TestProviderConnectionDependencies = defaultTestDependencies,
) {
  const connection = await dependencies.getConnectionById(id);

  if (!connection) {
    throw new ApiError(404, `Provider connection ${id} was not found.`, {
      reasonCode: "provider_connection_not_found",
      retryable: false,
      fieldHints: ["connectionId"],
      connectionId: id,
    });
  }

  try {
    const probeModelName = resolveConnectionProbeModelName(connection, input.modelName);

    if (!probeModelName) {
      throw new ApiError(
        400,
        `Provider ${connection.provider} requires a model ID to test the connection. Please provide a probe model name.`,
        {
          reasonCode: "provider_connection_probe_model_required",
          retryable: false,
          fieldHints: ["modelName", "providerTemplate"],
          connectionId: id,
          provider: connection.provider,
        },
      );
    }

    const runtimeConfig = toProbeRuntimeConfig(connection, probeModelName);
    const adapter = dependencies.createAdapter(runtimeConfig);
    await adapter.testConnection(runtimeConfig);

    return dependencies.persistAuthResult(id, {
      status: "SUCCESS",
      message: `Connection test succeeded with probe model ${probeModelName}.`,
    });
  } catch (error) {
    await dependencies.persistAuthResult(id, {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Connection test failed.",
    });

    throw error;
  }
}

export async function discoverModelsByConnectionId(
  id: string,
  dependencies: DiscoverModelsByConnectionDependencies = defaultDiscoverDependencies,
) {
  const connection = await dependencies.getConnectionById(id);

  if (!connection) {
    throw new ApiError(404, `Provider connection ${id} was not found.`, {
      reasonCode: "provider_connection_not_found",
      retryable: false,
      fieldHints: ["connectionId"],
      connectionId: id,
    });
  }

  if (connection.discoveryStrategy === "MANUAL_ONLY") {
    throw new ApiError(
      400,
      `Provider connection ${connection.name} is configured for manual model entry only.`,
      {
        reasonCode: "provider_connection_manual_only",
        retryable: false,
        fieldHints: ["discoveryStrategy", "modelName"],
        connectionId: id,
        connectionName: connection.name,
        discoveryStrategy: connection.discoveryStrategy,
      },
    );
  }

  const runtimeConnection = toProviderConnectionRuntime(connection);

  try {
    const models = await dependencies.discoverProviderModels({
      provider: runtimeConnection.provider,
      baseUrl: runtimeConnection.baseUrl,
      apiKey: runtimeConnection.apiKey,
    });

    await dependencies.persistDiscoveryResult(id, {
      status: "SUCCESS",
      message: `Discovered ${models.length} model(s).`,
    });

    return models;
  } catch (error) {
    await dependencies.persistDiscoveryResult(id, {
      status: "ERROR",
      message: error instanceof Error ? error.message : "Model discovery failed.",
    });

    throw error;
  }
}
