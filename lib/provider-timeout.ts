function normalizeProviderErrorMessage(message: string) {
  return message.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isProviderTimeoutLikeMessage(message: string) {
  const normalized = normalizeProviderErrorMessage(message);

  return (
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("task canceled") ||
    normalized.includes("task cancelled") ||
    normalized.includes("taskcanceledexception") ||
    normalized.includes("etimedout") ||
    normalized.includes("aborterror") ||
    normalized.includes("socket hang up") ||
    normalized.includes("before the provider responded")
  );
}
