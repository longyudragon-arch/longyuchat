import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { emptyWithRequestId, jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import {
  deleteDailySource,
  updateDailySource,
} from "@/server/services/daily-source-service";

const updateDailySourceSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(["RSS", "AIHOT", "GITHUB_RELEASES", "GITHUB_REPO_EVENTS", "HACKERNEWS", "REDDIT", "WEB_FEED"]).optional(),
  baseUrl: z.string().trim().min(1).optional().nullable(),
  feedUrl: z.string().trim().min(1).optional().nullable(),
  configJson: z.string().trim().optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateDailySourceSchema);
    const source = await updateDailySource(id, body);

    return jsonWithRequestId(request, { source });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteDailySource(id);
    return emptyWithRequestId(request, { status: 204 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
