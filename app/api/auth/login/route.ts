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
import { constantTimeEqual } from "@/lib/server-access";
import { withRequestIdHeader } from "@/server/http/api-response";
import { handleRouteError, ApiError } from "@/server/http/api-error";
import { assertLoginRateLimit } from "@/server/http/rate-limit";
import { parseJsonBody } from "@/server/http/request";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    assertLoginRateLimit(request);

    if (!isAppLoginEnabled()) {
      throw new ApiError(503, "App login is not enabled on this server.", {
        reasonCode: "app_login_disabled",
        retryable: false,
      });
    }

    const body = await parseJsonBody(request, loginSchema);
    const configuredUsername = getAppLoginUsername();
    const configuredPassword = process.env.APP_LOGIN_PASSWORD?.trim();

    if (!configuredUsername || !configuredPassword) {
      throw new ApiError(503, "App login credentials are incomplete.", {
        reasonCode: "app_login_misconfigured",
        retryable: false,
        fieldHints: ["APP_LOGIN_USERNAME", "APP_LOGIN_PASSWORD"],
      });
    }

    if (
      !constantTimeEqual(body.username, configuredUsername) ||
      !constantTimeEqual(body.password, configuredPassword)
    ) {
      throw new ApiError(401, "Invalid username or password.", {
        reasonCode: "invalid_credentials",
        retryable: true,
        fieldHints: ["username", "password"],
      });
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
