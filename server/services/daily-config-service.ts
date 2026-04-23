import { getProviderRequestTimeoutMs } from "@/lib/runtime";

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

function parsePositiveIntegerEnv(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFloatEnv(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAiDailyAutomationToken(explicitValue = process.env.AI_DAILY_AUTOMATION_TOKEN) {
  return explicitValue?.trim() || null;
}

export function isAiDailyAutomationAuthorized(
  headerValue: string | null,
  expectedToken = getAiDailyAutomationToken(),
) {
  if (!expectedToken) {
    return false;
  }

  const [scheme, token] = headerValue?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token === expectedToken;
}

export function getAiDailyModelId(explicitValue = process.env.AI_DAILY_MODEL_ID) {
  return explicitValue?.trim() || null;
}

export function getAiDailyCandidateLimit(explicitValue = process.env.AI_DAILY_CANDIDATE_LIMIT) {
  return parsePositiveIntegerEnv(explicitValue, 12);
}

export function getAiDailyPublishItemLimit(explicitValue = process.env.AI_DAILY_PUBLISH_ITEM_LIMIT) {
  return parsePositiveIntegerEnv(explicitValue, 6);
}

export function getAiDailyMinimumItemCount(explicitValue = process.env.AI_DAILY_MINIMUM_ITEM_COUNT) {
  return parsePositiveIntegerEnv(explicitValue, 3);
}

export function getAiDailyHeuristicScoreThreshold(explicitValue = process.env.AI_DAILY_HEURISTIC_SCORE_THRESHOLD) {
  return parseFloatEnv(explicitValue, 4.5);
}

export function getAiDailyPublishWindowHours(explicitValue = process.env.AI_DAILY_PUBLISH_WINDOW_HOURS) {
  return parsePositiveIntegerEnv(explicitValue, 24);
}

export function getAiDailyFeedBaseUrl(explicitValue = process.env.AI_DAILY_FEED_BASE_URL) {
  return explicitValue?.trim() || null;
}

export function isAiDailyFeatureEnabled(explicitValue = process.env.AI_DAILY_ENABLED) {
  return parseBooleanEnv(explicitValue) ?? true;
}

export function getAiDailyGenerationTimeoutMs(explicitValue = process.env.AI_DAILY_GENERATION_TIMEOUT_MS) {
  return parsePositiveIntegerEnv(explicitValue, getProviderRequestTimeoutMs());
}

export function getAiDailyTimezone(explicitValue = process.env.AI_DAILY_TIMEZONE) {
  return explicitValue?.trim() || "Asia/Shanghai";
}
