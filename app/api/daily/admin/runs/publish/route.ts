import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { runDailyPublish } from "@/server/services/daily-pipeline-service";

const publishSchema = z
  .object({
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, publishSchema);
    const result = await runDailyPublish(body ?? undefined);
    return jsonWithRequestId(request, { result });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
