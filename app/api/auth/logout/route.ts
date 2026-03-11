import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE_NAME } from "@/lib/app-auth";
import { withRequestIdHeader } from "@/server/http/api-response";
import { handleRouteError } from "@/server/http/api-error";

export async function POST(request: Request) {
  try {
    const response = withRequestIdHeader(
      request,
      NextResponse.json({
        ok: true,
      }),
    );

    response.cookies.set(APP_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleRouteError(error, request);
  }
}
