const requestIdPattern = /^[A-Za-z0-9._:-]{6,200}$/;

export const REQUEST_ID_HEADER = "x-request-id";

function normalizeRequestId(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return requestIdPattern.test(normalized) ? normalized : null;
}

export function getOrCreateRequestId(request?: Pick<Request, "headers"> | null) {
  const existing = normalizeRequestId(request?.headers.get(REQUEST_ID_HEADER) ?? null);

  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}
