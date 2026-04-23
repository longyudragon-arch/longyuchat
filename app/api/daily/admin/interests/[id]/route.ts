import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { emptyWithRequestId, jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import {
  deleteDailyInterestProfile,
  updateDailyInterestProfile,
} from "@/server/services/daily-interest-service";

const updateDailyInterestProfileSchema = z.object({
  name: z.string().min(1).optional(),
  includeKeywordsJson: z.string().trim().optional().nullable(),
  excludeKeywordsJson: z.string().trim().optional().nullable(),
  interestsText: z.string().trim().optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateDailyInterestProfileSchema);
    const profile = await updateDailyInterestProfile(id, body);
    return jsonWithRequestId(request, { profile });
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
    await deleteDailyInterestProfile(id);
    return emptyWithRequestId(request, { status: 204 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
