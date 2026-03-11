import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { assertModelTestRateLimit } from "@/server/http/rate-limit";
import { presentModelConfig } from "@/server/presenters/api-presenters";
import { testModelConnectionById } from "@/server/services/model-config-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    assertModelTestRateLimit(_request);
    const { id } = await context.params;
    const model = await testModelConnectionById(id);

    return jsonWithRequestId(_request, {
      ok: true,
      model: presentModelConfig(model),
    });
  } catch (error) {
    return handleRouteError(error, _request);
  }
}
