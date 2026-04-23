import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import {
  createDailySource,
  listDailySources,
} from "@/server/services/daily-source-service";

const createDailySourceSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["RSS", "GITHUB_RELEASES", "GITHUB_REPO_EVENTS", "HACKERNEWS", "REDDIT", "WEB_FEED"]),
  baseUrl: z.string().trim().min(1).optional().nullable(),
  feedUrl: z.string().trim().min(1).optional().nullable(),
  configJson: z.string().trim().optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  try {
    const sources = await listDailySources();
    return jsonWithRequestId(request, { sources });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, createDailySourceSchema);
    const source = await createDailySource(body);

    return jsonWithRequestId(
      request,
      { source },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
