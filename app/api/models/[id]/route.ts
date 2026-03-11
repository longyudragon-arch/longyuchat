import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { emptyWithRequestId, jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentModelConfig } from "@/server/presenters/api-presenters";
import { deleteModelConfig, getModelConfigById, updateModelConfig } from "@/server/services/model-config-service";

const updateModelSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z
    .enum([
      "OPENAI_COMPATIBLE",
      "CLAUDE",
      "GEMINI",
      "GROK",
      "DOUBAO",
      "DEEPSEEK",
      "MODELSCOPE",
      "HUNYUAN",
      "QWEN",
    ])
    .optional(),
  baseUrl: z.string().url().optional(),
  modelName: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  defaultReplyLength: z.number().int().min(50).max(4000).optional(),
  enabled: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const model = await getModelConfigById(id);

    if (!model) {
      return jsonWithRequestId(_request, { error: "The requested record was not found." }, { status: 404 });
    }

    return jsonWithRequestId(_request, { model: presentModelConfig(model) });
  } catch (error) {
    return handleRouteError(error, _request);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateModelSchema);
    const model = await updateModelConfig(id, body);

    return jsonWithRequestId(request, { model: presentModelConfig(model) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteModelConfig(id);

    return emptyWithRequestId(_request, { status: 204 });
  } catch (error) {
    return handleRouteError(error, _request);
  }
}
