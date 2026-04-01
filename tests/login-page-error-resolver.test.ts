import { describe, expect, it } from "vitest";

import { ClientRequestError, type ClientErrorFeedback } from "@/lib/client/chat-lab-client";
import { resolveLoginFieldErrors } from "@/components/login-page-error-resolver";

const genericFeedback: ClientErrorFeedback = {
  title: "操作没有完成",
  description: "请求失败。",
  suggestion: "请稍后重试。",
  tone: "error",
};

describe("resolveLoginFieldErrors", () => {
  it("prefers structured field hints for invalid credentials", () => {
    const fieldErrors = resolveLoginFieldErrors(
      new ClientRequestError("Invalid username or password.", 401, {
        reasonCode: "invalid_credentials",
        fieldHints: ["username", "password"],
      }),
      genericFeedback,
    );

    expect(fieldErrors.username).toContain("用户名");
    expect(fieldErrors.password).toContain("密码");
  });

  it("falls back to feedback heuristics when no structured hints exist", () => {
    const fieldErrors = resolveLoginFieldErrors(
      new Error("Invalid username or password."),
      {
        title: "用户名或密码不正确",
        description: "请输入正确的登录信息。",
        suggestion: "请检查后重试。",
        tone: "warning",
      },
    );

    expect(fieldErrors.username).toContain("用户名");
    expect(fieldErrors.password).toContain("密码");
  });
});
