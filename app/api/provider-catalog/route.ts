import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { presentProviderConnectionTemplateList } from "@/server/presenters/api-presenters";
import { listProviderConnectionTemplates } from "@/server/services/provider-catalog-service";

export async function GET(request: Request) {
  try {
    const templates = await listProviderConnectionTemplates();

    return jsonWithRequestId(request, {
      templates: presentProviderConnectionTemplateList(templates),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
