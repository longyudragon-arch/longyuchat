import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { assertModelTestRateLimit } from "@/server/http/rate-limit";
import { presentProviderConnection } from "@/server/presenters/api-presenters";
import { getProviderConnectionById, testProviderConnectionById } from "@/server/services/provider-connection-service";

const testProviderConnectionSchema = z
  .object({
    modelName: z.string().min(1).optional(),
  })
  .optional();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertModelTestRateLimit(request);
    const { id } = await context.params;
    const rawBody = await request.text();
    const body = rawBody ? testProviderConnectionSchema.parse(JSON.parse(rawBody)) : undefined;
    const connection = await testProviderConnectionById(id, {
      modelName: body?.modelName,
    });
    const hydratedConnection = await getProviderConnectionById(connection.id);

    return jsonWithRequestId(request, {
      ok: true,
      connection: presentProviderConnection(
        hydratedConnection ?? {
          ...connection,
          _count: {
            models: 0,
          },
        },
      ),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
