import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { requestProvider } from "@/server/http/provider-request";

const originalPlatform = process.platform;

function createConnectTimeoutError() {
  const error = new TypeError("fetch failed") as TypeError & {
    cause?: {
      code?: string;
      message?: string;
    };
  };

  error.cause = {
    code: "UND_ERR_CONNECT_TIMEOUT",
    message: "Connect Timeout Error",
  };

  return error;
}

describe("requestProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    execFileMock.mockReset();
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("falls back to PowerShell when Node fetch times out on Windows", async () => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw createConnectTimeoutError();
      }),
    );

    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          ok: true,
          status: 200,
          body: '{"choices":[{"message":{"content":"pong"}}]}',
        }),
        "",
      );
    });

    const result = await requestProvider({
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    expect(result.transport).toBe("powershell");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledOnce();
    expect(execFileMock.mock.calls[0]?.[1]?.[2]).toContain("[Console]::OutputEncoding = $utf8");
  });

  it("preserves unicode provider payloads returned through PowerShell", async () => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw createConnectTimeoutError();
      }),
    );

    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(
        null,
        `\ufeff${JSON.stringify({
          ok: true,
          status: 200,
          body: '{"choices":[{"message":{"content":"你好，欢迎使用 Gemini。"}}]}',
        })}`,
        "",
      );
    });

    const result = await requestProvider({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "你好" }],
      }),
    });

    expect(result.transport).toBe("powershell");
    expect(result.bodyText).toContain("你好，欢迎使用 Gemini。");
  });

  it("returns a readable transport error when both request paths fail", async () => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw createConnectTimeoutError();
      }),
    );

    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(new Error("PowerShell HttpClient timed out."));
    });

    await expect(
      requestProvider({
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: "ping" }],
        }),
      }),
    ).rejects.toThrow(
      "Could not reach https://api.openai.com/v1/chat/completions. Provider request timed out after 120s before the provider responded. PowerShell fallback also failed: PowerShell HttpClient timed out.",
    );
  });
});
