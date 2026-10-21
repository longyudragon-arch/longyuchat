import type { z } from "zod";
import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import { ApiError } from "@/server/http/api-error";
import { getAiDailyGenerationTimeoutMs, getAiDailyModelId } from "@/server/services/daily-config-service";
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

async function withAiDailyGenerationTimeout<T>(operation: Promise<T>) {
  const timeoutMs = getAiDailyGenerationTimeoutMs();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  operation.catch(() => {
    // The caller handles the timeout path. Keep late provider failures from becoming unhandled rejections.
  });

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ApiError(504, `AI daily generation timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
  const reply = await withAiDailyGenerationTimeout(
    adapter.generateReply({
      config: {
        ...runtimeConfig,
        defaultReplyLength: Math.max(runtimeConfig.defaultReplyLength, input.defaultReplyLength ?? 2400),
      },
      messages,
    }),
  );

  return reply.content.trim();
}

export async function generateAiDailyJson<T>(input: {
  system: string;
  user: string;
  defaultReplyLength?: number;
  schema: z.ZodType<T>;
}) {
  const response = await generateAiDailyText(input);

  if (!response) {
    return null;
  }

  const jsonBlock = extractJsonBlock(response);

  try {
    return input.schema.parse(JSON.parse(jsonBlock));
  } catch {
    throw new ApiError(
      502,
      "AI daily model returned JSON that does not match the required structure.",
    );
  }
}
