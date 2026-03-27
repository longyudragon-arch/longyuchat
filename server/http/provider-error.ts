import { ApiError } from "@/server/http/api-error";

export type ProviderErrorKind =
  | "authentication"
  | "quota"
  | "not_found"
  | "network"
  | "empty_response"
  | "reasoning_only"
  | "request";

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
    normalized.includes("key not found") ||
    normalized.includes("api key not found") ||
    normalized.includes("invalid api key") ||
    normalized.includes("incorrect api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication failed")
  );
}

function isQuotaFailure(status: number, normalized: string) {
  return (
    status === 429 ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("token is exhausted") ||
    normalized.includes("tokens are exhausted")
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

function isNetworkFailure(normalized: string) {
  return (
    normalized.includes("could not reach") ||
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("network")
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

  if (isNetworkFailure(normalized)) {
    return "network";
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
    normalized.includes("insufficient_quota") ||
    normalized.includes("token is exhausted") ||
    normalized.includes("tokens are exhausted")
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

  if (normalized.includes("reasoning content but no final answer")) {
    return "reasoning_only";
  }

  if (normalized.includes("returned an empty response") || normalized.includes("empty final answer")) {
    return "empty_response";
  }

  if (isNetworkFailure(normalized)) {
    return "network";
  }

  return "request";
}

export function shouldPauseModelOnProviderErrorKind(kind: ProviderErrorKind) {
  return (
    kind === "authentication" ||
    kind === "quota" ||
    kind === "not_found"
  );
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

  if (kind === "network") {
    return `Provider network request failed with ${status}: ${summary || bodyText.slice(0, 600)}`;
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

export function createProviderResponseApiError(input: {
  provider: string;
  endpoint: string;
  kind: "empty_response" | "reasoning_only";
  finishReason?: string | null;
  attemptCount: number;
  contentLength: number;
  reasoningLength: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  reasoningTokens?: number | null;
  initialFinishReason?: string | null;
  initialPromptTokens?: number | null;
  initialCompletionTokens?: number | null;
  initialReasoningTokens?: number | null;
}) {
  const finishReason = input.finishReason ? ` finish_reason=${input.finishReason}.` : "";
  const completionTokens =
    typeof input.completionTokens === "number" ? ` completion_tokens=${input.completionTokens}.` : "";
  const message =
    input.kind === "reasoning_only"
      ? `The provider returned reasoning content but no final answer.${finishReason}${completionTokens}`
      : `The provider returned an empty response without a usable final answer.${finishReason}${completionTokens}`;

  return new ApiError(502, message, {
    provider: input.provider,
    providerErrorKind: input.kind,
    endpoint: input.endpoint,
    finishReason: input.finishReason ?? null,
    attemptCount: input.attemptCount,
    contentLength: input.contentLength,
    reasoningLength: input.reasoningLength,
    promptTokens: input.promptTokens ?? null,
    completionTokens: input.completionTokens ?? null,
    reasoningTokens: input.reasoningTokens ?? null,
    initialFinishReason: input.initialFinishReason ?? null,
    initialPromptTokens: input.initialPromptTokens ?? null,
    initialCompletionTokens: input.initialCompletionTokens ?? null,
    initialReasoningTokens: input.initialReasoningTokens ?? null,
  });
}
