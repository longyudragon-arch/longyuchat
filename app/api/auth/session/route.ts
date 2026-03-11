import type { NextRequest } from "next/server";

import {
  APP_SESSION_COOKIE_NAME,
  getAccessProtectionMode,
  getAppLoginUsername,
  isAppLoginEnabled,
  isAppSessionAuthorized,
} from "@/lib/app-auth";
import { jsonWithRequestId } from "@/server/http/api-response";
import { handleRouteError } from "@/server/http/api-error";

export async function GET(request: NextRequest) {
  try {
    const appLoginEnabled = isAppLoginEnabled();
    const authenticated = appLoginEnabled
      ? await isAppSessionAuthorized(request.cookies.get(APP_SESSION_COOKIE_NAME)?.value)
      : false;

    return jsonWithRequestId(request, {
      mode: getAccessProtectionMode(),
      appLoginEnabled,
      authenticated,
      username: authenticated ? getAppLoginUsername() : null,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
