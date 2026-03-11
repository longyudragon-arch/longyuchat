import { NextResponse } from "next/server";
import { z } from "zod";

import {
  APP_SESSION_COOKIE_NAME,
  createAppSessionToken,
  getAppLoginSessionMaxAgeSeconds,
  getAppLoginUsername,
  isAppLoginEnabled,
  resolveSafeNextPath,
} from "@/lib/app-auth";
import { withRequestIdHeader } from "@/server/http/api-response";
import { handleRouteError, ApiError } from "@/server/http/api-error";
import { parseJsonBody } from "@/server/http/request";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isAppLoginEnabled()) {
      throw new ApiError(503, "App login is not enabled on this server.");
    }

    const body = await parseJsonBody(request, loginSchema);
    const configuredUsername = getAppLoginUsername();
    const configuredPassword = process.env.APP_LOGIN_PASSWORD?.trim();

    if (!configuredUsername || !configuredPassword) {
      throw new ApiError(503, "App login credentials are incomplete.");
    }

    if (body.username !== configuredUsername || body.password !== configuredPassword) {
      throw new ApiError(401, "Invalid username or password.");
    }

    const response = withRequestIdHeader(
      request,
      NextResponse.json({
        ok: true,
        nextPath: resolveSafeNextPath(body.next),
      }),
    );

    response.cookies.set(APP_SESSION_COOKIE_NAME, await createAppSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getAppLoginSessionMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    return handleRouteError(error, request);
  }
}
