import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import {
  backfillDailyMajorEventsFromAihot,
  seedDefaultDailyMajorEvents,
} from "@/server/services/daily-major-event-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const includeAihot = body?.includeAihot !== false;
    const seeded = await seedDefaultDailyMajorEvents();
    let aihot: Awaited<ReturnType<typeof backfillDailyMajorEventsFromAihot>> = [];
    let aihotError: string | null = null;

    if (includeAihot) {
      try {
        aihot = await backfillDailyMajorEventsFromAihot({
          take: typeof body?.take === "number" ? body.take : 30,
          maxEventsPerDay: typeof body?.maxEventsPerDay === "number" ? body.maxEventsPerDay : 1,
        });
      } catch (error) {
        aihotError = error instanceof Error ? error.message : "AI HOT backfill failed.";
      }
    }

    return jsonWithRequestId(request, {
      seeded,
      aihot,
      aihotError,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
