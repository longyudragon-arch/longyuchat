import { NextResponse, type NextRequest } from "next/server";

import {
  isBasicAuthAuthorized,
  isHealthcheckBearerAuthorized,
  isPublicAccessPath,
  isServerAccessProtectionEnabled,
} from "@/lib/server-access";

function createUnauthorizedResponse(request: NextRequest) {
  const headers = new Headers({
    "WWW-Authenticate": 'Basic realm="AI Chat Lab", charset="UTF-8"',
  });

  if (request.nextUrl.pathname.startsWith("/api/")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new NextResponse(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers,
    });
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers,
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAccessPath(pathname) || !isServerAccessProtectionEnabled()) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");

  if (pathname === "/api/health" && isHealthcheckBearerAuthorized(authorization)) {
    return NextResponse.next();
  }

  if (isBasicAuthAuthorized(authorization)) {
    return NextResponse.next();
  }

  return createUnauthorizedResponse(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
