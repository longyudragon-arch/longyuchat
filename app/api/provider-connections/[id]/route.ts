import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { emptyWithRequestId, jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentProviderConnection } from "@/server/presenters/api-presenters";
import {
  deleteProviderConnection,
  getProviderConnectionById,
  updateProviderConnection,
} from "@/server/services/provider-connection-service";

const updateProviderConnectionSchema = z.object({
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
  apiKey: z.string().min(1).optional(),
  discoveryStrategy: z.enum(["AUTO_FETCH", "MANUAL_ONLY", "AUTO_FETCH_WITH_MANUAL_FALLBACK"]).optional(),
  enabled: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const connection = await getProviderConnectionById(id);

    if (!connection) {
      return jsonWithRequestId(request, { error: "The requested record was not found." }, { status: 404 });
    }

    return jsonWithRequestId(request, { connection: presentProviderConnection(connection) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateProviderConnectionSchema);
    const connection = await updateProviderConnection(id, body);

    return jsonWithRequestId(request, {
      connection: presentProviderConnection(connection),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteProviderConnection(id);
    return emptyWithRequestId(request, { status: 204 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
