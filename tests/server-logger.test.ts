import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, handleRouteError } from "@/server/http/api-error";
import { logServerEvent, sanitizeForLogging } from "@/server/observability/server-logger";

describe("sanitizeForLogging", () => {
  it("redacts opaque credentials by field name throughout nested objects and arrays", () => {
    expect(sanitizeForLogging({
      api_key: "opaque-value",
      nested: [{ Authorization: "Basic opaque", clientSecret: "opaque", access_token: "opaque", password: "opaque" }],
      headers: { Cookie: "session=opaque", "Set-Cookie": ["opaque"] },
      modelName: "public-model",
    })).toEqual({
      api_key: "[REDACTED]",
      nested: [{ Authorization: "[REDACTED]", clientSecret: "[REDACTED]", access_token: "[REDACTED]", password: "[REDACTED]" }],
      headers: { Cookie: "[REDACTED]", "Set-Cookie": "[REDACTED]" },
      modelName: "public-model",
    });
  });

  it("redacts common API key and bearer token patterns", () => {
    const sanitized = sanitizeForLogging({
      apiKey: "AIzaSyExampleKey1234567890abcd",
      message: 'Authorization: Bearer sk-secret-key-1234567890 apiKey=top-secret',
    });

    expect(sanitized).toEqual({
      apiKey: "[REDACTED]",
      message: "Authorization: Bearer [REDACTED] apiKey=[REDACTED]",
    });
  });
});

describe("handleRouteError", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

  afterEach(() => {
    delete process.env.ENABLE_FILE_LOGGING;
    delete process.env.APP_LOG_DIR;
    errorSpy.mockClear();
    warnSpy.mockClear();
    infoSpy.mockClear();
  });

  it("adds the request ID header and logs a redacted server error", async () => {
    const request = new Request("https://example.com/api/models", {
      method: "POST",
      headers: {
        "x-request-id": "req-test-123456",
      },
    });

    const response = handleRouteError(
      new ApiError(500, "Failed to store model.", {
        apiKey: "AIzaSyExampleKey1234567890abcd",
        authorization: "Authorization: Bearer sk-secret-key-1234567890",
      }),
      request,
    );

    expect(response.headers.get("x-request-id")).toBe("req-test-123456");
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const [logPayload] = errorSpy.mock.calls[0] ?? [];
    expect(String(logPayload)).toContain('"requestId":"req-test-123456"');
    expect(String(logPayload)).toContain("[REDACTED]");
    expect(String(logPayload)).not.toContain("AIzaSyExampleKey1234567890abcd");
    expect(String(logPayload)).not.toContain("sk-secret-key-1234567890");

    const body = await response.json();
    expect(body.requestId).toBe("req-test-123456");
  });

  it("logs client-side API errors through console.warn", () => {
    const request = new Request("https://example.com/api/models", {
      method: "POST",
    });

    handleRouteError(new ApiError(400, "Invalid request payload."), request);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("writes JSON log lines into the configured daily log file", () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "longyuchat-logs-"));
    process.env.ENABLE_FILE_LOGGING = "true";
    process.env.APP_LOG_DIR = tempDirectory;

    logServerEvent("info", "test_event", {
      apiKey: "AIzaSyExampleKey1234567890abcd",
    });

    const [logFileName] = fs.readdirSync(tempDirectory);
    expect(logFileName).toMatch(/^server-\d{4}-\d{2}-\d{2}\.log$/);

    const logContents = fs.readFileSync(path.join(tempDirectory, logFileName), "utf8");
    expect(logContents).toContain('"event":"test_event"');
    expect(logContents).toContain("[REDACTED]");
    expect(logContents).not.toContain("AIzaSyExampleKey1234567890abcd");
  });
});
