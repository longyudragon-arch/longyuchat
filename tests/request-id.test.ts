import { describe, expect, it } from "vitest";

import { getOrCreateRequestId } from "@/lib/request-id";

describe("getOrCreateRequestId", () => {
  it("reuses a valid incoming request ID header", () => {
    const request = new Request("https://example.com/api/models", {
      headers: {
        "x-request-id": "req-demo-123456",
      },
    });

    expect(getOrCreateRequestId(request)).toBe("req-demo-123456");
  });

  it("generates a UUID when the incoming header is missing or invalid", () => {
    const request = new Request("https://example.com/api/models", {
      headers: {
        "x-request-id": "bad value with spaces",
      },
    });

    const requestId = getOrCreateRequestId(request);

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
