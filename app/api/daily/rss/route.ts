import { buildDailyRssXml } from "@/server/services/daily-pipeline-service";
import { handleRouteError } from "@/server/http/api-error";

export async function GET(request: Request) {
  try {
    const xml = await buildDailyRssXml();

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
