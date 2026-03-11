function parseBooleanEnv(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function decodeBase64(value: string) {
  if (typeof atob === "function") {
    return atob(value);
  }

  return Buffer.from(value, "base64").toString("utf8");
}

export function isPublicAccessPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export function isServerAccessProtectionEnabled(input?: {
  enabled?: string;
  username?: string;
  password?: string;
}) {
  const explicit = parseBooleanEnv(input?.enabled ?? process.env.BASIC_AUTH_ENABLED);

  if (explicit !== undefined) {
    return explicit;
  }

  const username = input?.username ?? process.env.BASIC_AUTH_USERNAME;
  const password = input?.password ?? process.env.BASIC_AUTH_PASSWORD;

  return Boolean(username?.trim() && password?.trim());
}

export function parseBasicAuthHeader(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }

  const [scheme, encoded] = headerValue.split(" ");

  if (!scheme || !encoded || scheme.toLowerCase() !== "basic") {
    return null;
  }

  try {
    const decoded = decodeBase64(encoded);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function isBasicAuthAuthorized(
  headerValue: string | null,
  expectedUsername = process.env.BASIC_AUTH_USERNAME,
  expectedPassword = process.env.BASIC_AUTH_PASSWORD,
) {
  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const credentials = parseBasicAuthHeader(headerValue);

  if (!credentials) {
    return false;
  }

  return credentials.username === expectedUsername && credentials.password === expectedPassword;
}

export function isHealthcheckBearerAuthorized(
  headerValue: string | null,
  expectedToken = process.env.HEALTHCHECK_BEARER_TOKEN,
) {
  if (!expectedToken) {
    return false;
  }

  const [scheme, token] = headerValue?.split(" ") ?? [];

  return scheme?.toLowerCase() === "bearer" && token === expectedToken;
}
