import { jsonWithRequestId } from "@/server/http/api-response";
import { handleRouteError } from "@/server/http/api-error";
import { listRecentDailyRuns } from "@/server/services/daily-run-service";

export async function GET(request: Request) {
  try {
    const runs = await listRecentDailyRuns(20);
    return jsonWithRequestId(request, { runs });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
