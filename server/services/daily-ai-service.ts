import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import { ApiError } from "@/server/http/api-error";
import { getAiDailyModelId } from "@/server/services/daily-config-service";
import { getModelConfigById, listModelConfigs, toModelRuntimeConfig } from "@/server/services/model-config-service";
import type { ChatMessage, ModelRuntimeConfig } from "@/types/chat";

function stripMarkdownCodeFence(value: string) {
  const normalized = value.trim();

  if (normalized.startsWith("```")) {
    return normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  return normalized;
}

function extractJsonBlock(value: string) {
  const normalized = stripMarkdownCodeFence(value);
  const firstObject = normalized.indexOf("{");
  const lastObject = normalized.lastIndexOf("}");
  const firstArray = normalized.indexOf("[");
  const lastArray = normalized.lastIndexOf("]");

  if (firstObject >= 0 && lastObject > firstObject && (firstArray < 0 || firstObject < firstArray)) {
    return normalized.slice(firstObject, lastObject + 1);
  }

  if (firstArray >= 0 && lastArray > firstArray) {
    return normalized.slice(firstArray, lastArray + 1);
  }

  return normalized;
}

async function resolveAiDailyModelRuntimeConfig(): Promise<ModelRuntimeConfig | null> {
  const explicitModelId = getAiDailyModelId();

  if (explicitModelId) {
    const model = await getModelConfigById(explicitModelId);

    if (!model) {
      throw new ApiError(500, `AI_DAILY_MODEL_ID references a missing model: ${explicitModelId}`);
    }

    if (!model.enabled) {
      throw new ApiError(500, `AI_DAILY_MODEL_ID references a disabled model: ${model.name}`);
    }

    return toModelRuntimeConfig(model);
  }

  const models = await listModelConfigs();
  const enabledModel = models.find((model) => model.enabled);

  return enabledModel ? toModelRuntimeConfig(enabledModel) : null;
}

export async function getAiDailyModelRuntimeConfig() {
  return resolveAiDailyModelRuntimeConfig();
}

export async function generateAiDailyText(input: {
  system: string;
  user: string;
  defaultReplyLength?: number;
}) {
  const runtimeConfig = await resolveAiDailyModelRuntimeConfig();

  if (!runtimeConfig) {
    return null;
  }

  const adapter = createModelAdapter({
    ...runtimeConfig,
    defaultReplyLength: Math.max(runtimeConfig.defaultReplyLength, input.defaultReplyLength ?? 2400),
  });

  const messages: ChatMessage[] = [
    { role: "system", content: input.system.trim() },
    { role: "user", content: input.user.trim() },
  ];
  const reply = await adapter.generateReply({
    config: {
      ...runtimeConfig,
      defaultReplyLength: Math.max(runtimeConfig.defaultReplyLength, input.defaultReplyLength ?? 2400),
    },
    messages,
  });

  return reply.content.trim();
}

export async function generateAiDailyJson<T>(input: {
  system: string;
  user: string;
  defaultReplyLength?: number;
}) {
  const response = await generateAiDailyText(input);

  if (!response) {
    return null;
  }

  const jsonBlock = extractJsonBlock(response);

  try {
    return JSON.parse(jsonBlock) as T;
  } catch (error) {
    throw new ApiError(
      502,
      error instanceof Error
        ? `AI daily model did not return valid JSON. ${error.message}`
        : "AI daily model did not return valid JSON.",
    );
  }
}
