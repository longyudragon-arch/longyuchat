import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { listDailyIssues } from "@/server/services/daily-issue-service";

const querySchema = z.object({
  status: z.literal("PUBLISHED").optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const issues = await listDailyIssues({ ...query, status: "PUBLISHED" });

    return jsonWithRequestId(request, { issues });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
