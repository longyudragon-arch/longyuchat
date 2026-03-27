import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentProviderConnection, presentProviderConnectionList } from "@/server/presenters/api-presenters";
import { createProviderConnection, listProviderConnections } from "@/server/services/provider-connection-service";

const createProviderConnectionSchema = z.object({
  name: z.string().min(1),
  provider: z.enum([
    "OPENAI_COMPATIBLE",
    "CLAUDE",
    "GEMINI",
    "GROK",
    "DOUBAO",
    "DEEPSEEK",
    "MODELSCOPE",
    "HUNYUAN",
    "QWEN",
  ]),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  discoveryStrategy: z.enum(["AUTO_FETCH", "MANUAL_ONLY", "AUTO_FETCH_WITH_MANUAL_FALLBACK"]).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const connections = await listProviderConnections();
    return jsonWithRequestId(request, {
      connections: presentProviderConnectionList(connections),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, createProviderConnectionSchema);
    const connection = await createProviderConnection(body);

    return jsonWithRequestId(
      request,
      {
        connection: presentProviderConnection(connection),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
