import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import {
  createDailyInterestProfile,
  listDailyInterestProfiles,
} from "@/server/services/daily-interest-service";

const createDailyInterestProfileSchema = z.object({
  name: z.string().min(1),
  includeKeywordsJson: z.string().trim().optional().nullable(),
  excludeKeywordsJson: z.string().trim().optional().nullable(),
  interestsText: z.string().trim().optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  try {
    const profiles = await listDailyInterestProfiles();
    return jsonWithRequestId(request, { profiles });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, createDailyInterestProfileSchema);
    const profile = await createDailyInterestProfile(body);
    return jsonWithRequestId(
      request,
      { profile },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error, request);
  }
}
