import { NextResponse, type NextRequest } from "next/server";

import {
  APP_SESSION_COOKIE_NAME,
  getAccessProtectionMode,
  isAppSessionAuthorized,
  resolveSafeNextPath,
} from "@/lib/app-auth";
import {
  isBasicAuthAuthorized,
  isHealthcheckBearerAuthorized,
  isPublicAccessPath,
} from "@/lib/server-access";

const APP_LOGIN_PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
]);

function isAppLoginPublicPath(pathname: string) {
  return APP_LOGIN_PUBLIC_PATHS.has(pathname);
}

function createBasicUnauthorizedResponse(request: NextRequest) {
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

function createAppUnauthorizedResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Login required.",
      },
      {
        status: 401,
      },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    resolveSafeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
  );
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAccessPath(pathname)) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");

  if (pathname === "/api/health" && isHealthcheckBearerAuthorized(authorization)) {
    return NextResponse.next();
  }

  const protectionMode = getAccessProtectionMode();

  if (protectionMode === "none") {
    return NextResponse.next();
  }

  if (protectionMode === "basic") {
    if (isBasicAuthAuthorized(authorization)) {
      return NextResponse.next();
    }

    return createBasicUnauthorizedResponse(request);
  }

  if (isAppLoginPublicPath(pathname)) {
    if (pathname === "/login") {
      const isAuthenticated = await isAppSessionAuthorized(
        request.cookies.get(APP_SESSION_COOKIE_NAME)?.value,
      );

      if (isAuthenticated) {
        const targetUrl = new URL(
          resolveSafeNextPath(request.nextUrl.searchParams.get("next") ?? "/"),
          request.url,
        );
        return NextResponse.redirect(targetUrl);
      }
    }

    return NextResponse.next();
  }

  const isAuthenticated = await isAppSessionAuthorized(
    request.cookies.get(APP_SESSION_COOKIE_NAME)?.value,
  );

  if (isAuthenticated) {
    return NextResponse.next();
  }

  return createAppUnauthorizedResponse(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
