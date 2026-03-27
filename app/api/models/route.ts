import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentModelConfig, presentModelConfigList } from "@/server/presenters/api-presenters";
import { createModelConfig, listModelConfigs } from "@/server/services/model-config-service";

const providerEnumSchema = z.enum([
  "OPENAI_COMPATIBLE",
  "CLAUDE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
  "HUNYUAN",
  "QWEN",
]);

const createModelSchema = z
  .object({
    name: z.string().min(1),
    connectionId: z.string().min(1).optional(),
    provider: providerEnumSchema.optional(),
    baseUrl: z.string().url().optional(),
    modelName: z.string().min(1),
    avatarLabel: z.string().trim().min(1).max(3).optional(),
    avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    apiKey: z.string().min(1).optional(),

    defaultReplyLength: z.number().int().min(50).max(4000).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.connectionId) {
      return;
    }

    if (!value.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provider"],
        message: "Provider is required when connectionId is not provided.",
      });
    }

    if (!value.baseUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseUrl"],
        message: "Base URL is required when connectionId is not provided.",
      });
    }

    if (!value.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "API key is required when connectionId is not provided.",
      });
    }
  });

export async function GET(request: Request) {
  try {
    const models = await listModelConfigs();
    return jsonWithRequestId(request, { models: presentModelConfigList(models) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, createModelSchema);
    const model = await createModelConfig(body);

    return jsonWithRequestId(
      request,
      { model: presentModelConfig(model) },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
