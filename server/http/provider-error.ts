import { ApiError } from "@/server/http/api-error";

export type ProviderErrorKind = "authentication" | "quota" | "not_found" | "request";

function stripToSingleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function pushText(chunks: string[], value: unknown) {
  if (typeof value !== "string") {
    return;
  }

  const normalized = stripToSingleLine(value);

  if (normalized) {
    chunks.push(normalized);
  }
}

function collectErrorText(value: unknown, chunks: string[]) {
  if (typeof value === "string") {
    pushText(chunks, value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectErrorText(item, chunks);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;

  pushText(chunks, record.message);
  pushText(chunks, record.code);
  pushText(chunks, record.status);
  pushText(chunks, record.reason);
  collectErrorText(record.error, chunks);
  collectErrorText(record.details, chunks);
  collectErrorText(record.metadata, chunks);
}

function extractProviderErrorSummary(bodyText: string) {
  const source = bodyText.trim();

  if (!source) {
    return "";
  }

  try {
    const parsed = JSON.parse(source) as unknown;
    const chunks: string[] = [];
    collectErrorText(parsed, chunks);

    if (chunks.length > 0) {
      return chunks
        .filter((value, index) => chunks.indexOf(value) === index)
        .join(" | ")
        .slice(0, 600);
    }
  } catch {
    // Fall back to the original body text when the upstream payload is not JSON.
  }

  return stripToSingleLine(source).slice(0, 600);
}

function isAuthenticationFailure(status: number, normalized: string) {
  return (
    status === 401 ||
    status === 403 ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("api_key_invalid") ||
    normalized.includes("api key not found") ||
    normalized.includes("api key") ||
    normalized.includes("invalid api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication")
  );
}

function isQuotaFailure(status: number, normalized: string) {
  return (
    status === 429 ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota")
  );
}

function isMissingTargetFailure(status: number, normalized: string) {
  return (
    status === 404 ||
    normalized.includes("model not found") ||
    normalized.includes("not_found") ||
    normalized.includes("resource not found") ||
    normalized.includes("404")
  );
}

export function inferProviderErrorKind(status: number, bodyText: string): ProviderErrorKind {
  const summary = extractProviderErrorSummary(bodyText);
  const normalized = summary.toLowerCase();

  if (isAuthenticationFailure(status, normalized)) {
    return "authentication";
  }

  if (isQuotaFailure(status, normalized)) {
    return "quota";
  }

  if (isMissingTargetFailure(status, normalized)) {
    return "not_found";
  }

  return "request";
}

export function inferProviderErrorKindFromMessage(message: string): ProviderErrorKind {
  const normalized = stripToSingleLine(message).toLowerCase();

  if (
    normalized.includes("provider authentication failed") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("api_key_invalid") ||
    normalized.includes("api key not found") ||
    normalized.includes("invalid api key") ||
    normalized.includes("unauthorized")
  ) {
    return "authentication";
  }

  if (
    normalized.includes("provider quota or billing check failed") ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota")
  ) {
    return "quota";
  }

  if (
    normalized.includes("provider target was not found") ||
    normalized.includes("model not found") ||
    normalized.includes("resource not found")
  ) {
    return "not_found";
  }

  return "request";
}

export function formatProviderError(status: number, bodyText: string) {
  const summary = extractProviderErrorSummary(bodyText);
  const kind = inferProviderErrorKind(status, bodyText);

  if (kind === "authentication") {
    return `Provider authentication failed with ${status}: ${summary || "API key is invalid or missing."}`;
  }

  if (kind === "quota") {
    return `Provider quota or billing check failed with ${status}: ${summary || "The provider rejected the request because the quota or billing state is not available."}`;
  }

  if (kind === "not_found") {
    return `Provider target was not found with ${status}: ${summary || "The upstream model, endpoint, or resource does not exist."}`;
  }

  return `Provider request failed with ${status}: ${summary || bodyText.slice(0, 600)}`;
}

export function createProviderApiError(input: {
  status: number;
  bodyText: string;
  provider: string;
  endpoint: string;
}) {
  const message = formatProviderError(input.status, input.bodyText);
  const kind = inferProviderErrorKind(input.status, input.bodyText);

  return new ApiError(input.status, message, {
    provider: input.provider,
    providerErrorKind: kind,
    upstreamStatus: input.status,
    endpoint: input.endpoint,
  });
}
