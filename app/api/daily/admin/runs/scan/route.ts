import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { runDailyScan } from "@/server/services/daily-pipeline-service";

export async function POST(request: Request) {
  try {
    const result = await runDailyScan();
    return jsonWithRequestId(request, { result });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
