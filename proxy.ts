import { NextResponse, type NextRequest } from "next/server";

import {
  APP_SESSION_COOKIE_NAME,
  getAccessProtectionMode,
  isAppSessionAuthorized,
  resolveSafeNextPath,
} from "@/lib/app-auth";
import { getAppAuthScope, isUnprotectedAccessAllowedInProduction, type AppAuthScope } from "@/lib/runtime";
import {
  isBearerTokenAuthorized,
  isBasicAuthAuthorized,
  isHealthcheckBearerAuthorized,
  isPublicAccessPath,
} from "@/lib/server-access";
import { getAiDailyAutomationToken } from "@/server/services/daily-config-service";

const APP_LOGIN_PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
]);
const MUTATING_API_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CHAT_AUTH_PROTECTED_PREFIXES = [
  "/rooms",
  "/models",
  "/admin",
  "/api/rooms",
  "/api/models",
  "/api/provider-catalog",
  "/api/provider-connections",
  "/api/providers",
  "/api/daily/admin",
];

function isAppLoginPublicPath(pathname: string) {
  return APP_LOGIN_PUBLIC_PATHS.has(pathname);
}

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPathProtectedByAuthScope(pathname: string, scope: AppAuthScope) {
  if (scope === "all") {
    return true;
  }

  return CHAT_AUTH_PROTECTED_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
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

function createMissingAuthConfigurationResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Service unavailable: auth required.",
      },
      {
        status: 503,
      },
    );
  }

  return new NextResponse("Service unavailable: auth required.", {
    status: 503,
  });
}

function isMutatingApiRequest(request: NextRequest) {
  return request.nextUrl.pathname.startsWith("/api/") && MUTATING_API_METHODS.has(request.method.toUpperCase());
}

function hasJsonRequestContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type");

  if (contentType) {
    return contentType.toLowerCase().startsWith("application/json");
  }

  const contentLength = request.headers.get("content-length");
  return contentLength === null || contentLength === "0";
}

function getTrustedRequestOrigins(request: NextRequest) {
  const trustedOrigins = new Set([request.nextUrl.origin]);
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? host;
  const forwardedProto = request.headers.get("x-forwarded-proto");

  for (const nextHost of [host, forwardedHost]) {
    if (!nextHost) {
      continue;
    }

    trustedOrigins.add(`http://${nextHost}`);
    trustedOrigins.add(`https://${nextHost}`);

    if (forwardedProto) {
      trustedOrigins.add(`${forwardedProto.split(",")[0].trim()}://${nextHost}`);
    }
  }

  return trustedOrigins;
}

function isTrustedMutationOrigin(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const origin = request.headers.get("origin");
  const trustedOrigins = getTrustedRequestOrigins(request);

  if (origin) {
    return trustedOrigins.has(origin);
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return true;
  }

  try {
    return trustedOrigins.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

function createUnsupportedMediaTypeResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "API mutations must use application/json.",
      },
      {
        status: 415,
      },
    );
  }

  return new NextResponse("API mutations must use application/json.", {
    status: 415,
  });
}

function createCsrfRejectedResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Cross-site request rejected.",
      },
      {
        status: 403,
      },
    );
  }

  return new NextResponse("Cross-site request rejected.", {
    status: 403,
  });
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

  if (
    (pathname === "/api/daily/admin/runs/scan" || pathname === "/api/daily/admin/runs/publish") &&
    isBearerTokenAuthorized(authorization, getAiDailyAutomationToken())
  ) {
    return NextResponse.next();
  }

  if (isMutatingApiRequest(request)) {
    if (!hasJsonRequestContentType(request)) {
      return createUnsupportedMediaTypeResponse(request);
    }

    if (!isTrustedMutationOrigin(request)) {
      return createCsrfRejectedResponse(request);
    }
  }

  const protectionMode = getAccessProtectionMode();
  const authScope = getAppAuthScope();

  if (isAppLoginPublicPath(pathname)) {
    if (protectionMode === "app" && pathname === "/login") {
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

  if (!isPathProtectedByAuthScope(pathname, authScope)) {
    return NextResponse.next();
  }

  if (
    process.env.NODE_ENV === "production" &&
    protectionMode === "none" &&
    !isUnprotectedAccessAllowedInProduction()
  ) {
    return createMissingAuthConfigurationResponse(request);
  }

  if (protectionMode === "none") {
    return NextResponse.next();
  }

  if (protectionMode === "basic") {
    if (isBasicAuthAuthorized(authorization)) {
      return NextResponse.next();
    }

    return createBasicUnauthorizedResponse(request);
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
