import { ClientRequestError } from "@/lib/client/chat-lab-client";

export function getClientErrorFieldHints(error: unknown) {
  if (!(error instanceof ClientRequestError)) {
    return [];
  }

  if (!error.details || typeof error.details !== "object") {
    return [];
  }

  const candidate = (error.details as { fieldHints?: unknown }).fieldHints;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter((hint): hint is string => typeof hint === "string" && hint.trim().length > 0);
}
