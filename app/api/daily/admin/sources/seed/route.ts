import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { seedDefaultDailySources } from "@/server/services/daily-default-source-service";

export async function POST(request: Request) {
  try {
    const result = await seedDefaultDailySources();
    return jsonWithRequestId(request, result);
  } catch (error) {
    return handleRouteError(error, request);
  }
}
