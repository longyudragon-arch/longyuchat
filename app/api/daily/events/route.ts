import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { listDailyMajorEvents } from "@/server/services/daily-major-event-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const limitText = url.searchParams.get("limit");
    const minimumImportanceScoreText = url.searchParams.get("minimumImportanceScore");
    const limit = limitText ? Number.parseInt(limitText, 10) : 100;
    const minimumImportanceScore = minimumImportanceScoreText
      ? Number.parseInt(minimumImportanceScoreText, 10)
      : 90;
    const events = await listDailyMajorEvents({
      year,
      limit: Number.isFinite(limit) ? limit : 100,
      order: "asc",
      minimumImportanceScore: Number.isFinite(minimumImportanceScore) ? minimumImportanceScore : undefined,
    });

    return jsonWithRequestId(request, { events });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
