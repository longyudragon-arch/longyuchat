import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { assertModelDiscoveryRateLimit } from "@/server/http/rate-limit";
import { discoverModelsForSavedModel } from "@/server/services/model-config-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertModelDiscoveryRateLimit(request);
    const { id } = await context.params;
    const models = await discoverModelsForSavedModel(id);

    return jsonWithRequestId(request, { models });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
