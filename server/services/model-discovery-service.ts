import { ApiError } from "@/server/http/api-error";
import { createProviderApiError } from "@/server/http/provider-error";
import { requestProvider } from "@/server/http/provider-request";
import type { ProviderType } from "@/types/app";

export interface DiscoverModelsInput {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
}

export interface DiscoveredModel {
  id: string;
  label: string;
  description: string | null;
}

interface DiscoverModelsDependencies {
  requestProvider: typeof requestProvider;
}

interface OpenAiCompatibleModelRecord {
  id?: string;
  name?: string;
  model?: string;
  object?: string;
  owned_by?: string;
  created?: number;
  description?: string;
  type?: string;
}

interface OpenAiCompatibleModelsPayload {
  data?: OpenAiCompatibleModelRecord[];
  models?: OpenAiCompatibleModelRecord[];
  items?: OpenAiCompatibleModelRecord[];
}

const defaultDependencies: DiscoverModelsDependencies = {
  requestProvider,
};

const autoDiscoverableProviders = new Set<ProviderType>([
  "OPENAI_COMPATIBLE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
]);

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function assertAutoDiscoverableProvider(provider: ProviderType) {
  if (autoDiscoverableProviders.has(provider)) {
    return;
  }

  throw new ApiError(
    400,
    `Automatic model discovery for ${provider} is not available yet. Please enter the model ID manually.`,
  );
}

function toModelRecords(payload: OpenAiCompatibleModelsPayload | OpenAiCompatibleModelRecord[]) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.models)) {
    return payload.models;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

function toDiscoveredModel(record: OpenAiCompatibleModelRecord): DiscoveredModel | null {
  const id = (record.id ?? record.model ?? record.name ?? "").trim();

  if (!id) {
    return null;
  }

  const descriptionParts = [record.description, record.owned_by, record.type]
    .filter((part): part is string => Boolean(part?.trim()))
    .slice(0, 2);

  return {
    id,
    label: id,
    description: descriptionParts.length > 0 ? descriptionParts.join(" · ") : null,
  };
}

function sortAndDeduplicateModels(models: DiscoveredModel[]) {
  const uniqueModels = new Map<string, DiscoveredModel>();

  for (const model of models) {
    if (!uniqueModels.has(model.id)) {
      uniqueModels.set(model.id, model);
    }
  }

  return [...uniqueModels.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export async function discoverProviderModels(
  input: DiscoverModelsInput,
  dependencies: DiscoverModelsDependencies = defaultDependencies,
) {
  assertAutoDiscoverableProvider(input.provider);

  const response = await dependencies.requestProvider({
    url: `${normalizeBaseUrl(input.baseUrl)}/models`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
  });

  if (!response.ok) {
    throw createProviderApiError({
      status: response.status,
      bodyText: response.bodyText,
      provider: input.provider,
      endpoint: `${normalizeBaseUrl(input.baseUrl)}/models`,
    });
  }

  const payload = JSON.parse(response.bodyText) as OpenAiCompatibleModelsPayload | OpenAiCompatibleModelRecord[];
  const models = sortAndDeduplicateModels(
    toModelRecords(payload)
      .map(toDiscoveredModel)
      .filter((model): model is DiscoveredModel => Boolean(model)),
  );

  if (models.length === 0) {
    throw new Error("The provider returned an empty model list.");
  }

  return models;
}
