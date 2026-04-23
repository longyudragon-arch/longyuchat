import "dotenv/config";

function normalizeBaseUrl(value) {
  const normalized = value?.trim() || "http://127.0.0.1:3000";
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function resolveBaseUrl() {
  return normalizeBaseUrl(
    process.env.LONGYUCHAT_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      process.env.AI_DAILY_FEED_BASE_URL,
  );
}

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = process.env.AI_DAILY_AUTOMATION_TOKEN?.trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function callDailyApi(pathname, body = {}) {
  const baseUrl = resolveBaseUrl();
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error
        ? `${payload.error}${payload.requestId ? ` (requestId=${payload.requestId})` : ""}`
        : `Request failed with status ${response.status}.`,
    );
  }

  return payload;
}
