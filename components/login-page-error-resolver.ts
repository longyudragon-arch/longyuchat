import type { ClientErrorFeedback } from "@/lib/client/chat-lab-client";
import { getClientErrorFieldHints } from "@/lib/client/error-field-hints";

export type LoginFieldKey = "username" | "password";

function appendFieldError(
  current: Partial<Record<LoginFieldKey, string>>,
  key: LoginFieldKey,
  message: string,
) {
  if (!current[key]) {
    current[key] = message;
  }
}

function resolveLoginFieldErrorsFromFeedback(feedback: ClientErrorFeedback) {
  if (feedback.title.includes("用户名或密码不正确")) {
    return {
      username: "请检查登录用户名是否正确。",
      password: "请检查登录密码是否正确。",
    } satisfies Partial<Record<LoginFieldKey, string>>;
  }

  return {};
}

export function resolveLoginFieldErrors(
  error: unknown,
  feedback: ClientErrorFeedback,
): Partial<Record<LoginFieldKey, string>> {
  const resolved: Partial<Record<LoginFieldKey, string>> = {};

  for (const hint of getClientErrorFieldHints(error)) {
    switch (hint) {
      case "username":
        appendFieldError(resolved, "username", "请检查登录用户名是否正确。");
        break;
      case "password":
        appendFieldError(resolved, "password", "请检查登录密码是否正确。");
        break;
      default:
        break;
    }
  }

  if (Object.keys(resolved).length > 0) {
    return resolved;
  }

  return resolveLoginFieldErrorsFromFeedback(feedback);
}
