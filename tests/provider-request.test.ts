import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock, lookupMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  lookupMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

import { requestProvider } from "@/server/http/provider-request";

const originalPlatform = process.platform;
const originalSystemRoot = process.env.SystemRoot;

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
    lookupMock.mockReset();
    lookupMock.mockResolvedValue({ address: "198.51.100.7", family: 4 });
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform,
    });

    if (originalSystemRoot === undefined) {
      delete process.env.SystemRoot;
    } else {
      process.env.SystemRoot = originalSystemRoot;
    }
  });

  it("rejects requests to loopback and private targets before fetch runs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestProvider({
        url: "http://127.0.0.1:11434/v1/chat/completions",
      }),
    ).rejects.toThrow("Provider URL is not allowed");

    lookupMock.mockResolvedValueOnce({ address: "10.0.0.8", family: 4 });

    await expect(
      requestProvider({
        url: "https://internal.example/v1/models",
      }),
    ).rejects.toThrow("Provider URL is not allowed");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forces fetch requests to use manual redirect handling", async () => {
    const fetchMock = vi.fn(async () =>
      new Response('{"object":"list","data":[]}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestProvider({
      url: "https://api.openai.com/v1/models",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      redirect: "manual",
    });
  });

  it("passes only the minimum environment into the PowerShell fallback", async () => {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });
    process.env.SystemRoot = "C:\\Windows";
    process.env.APP_LOGIN_SESSION_SECRET = "should-not-leak";
    process.env.DATABASE_URL = "file:./prisma/test.db";

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

    await requestProvider({
      url: "https://api.openai.com/v1/chat/completions",
    });

    const options = execFileMock.mock.calls[0]?.[2];

    expect(options?.env).toEqual({
      CODEX_PROVIDER_REQUEST_PAYLOAD: expect.any(String),
      SystemRoot: "C:\\Windows",
    });
  });
});
