import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normalizeApiError } from "@/server/http/api-error";

describe("normalizeApiError", () => {
  it("adds structured reason codes for invalid request payloads", () => {
    const schema = z.object({
      name: z.string().min(1),
      enabled: z.boolean(),
    });

    let thrown: unknown;

    try {
      schema.parse({
        name: "",
        enabled: "yes",
      });
    } catch (error) {
      thrown = error;
    }

    const normalized = normalizeApiError(thrown);

    expect(normalized.status).toBe(400);
    expect(normalized.message).toBe("Invalid request payload.");
    expect(normalized.details).toMatchObject({
      reasonCode: "invalid_request_payload",
      retryable: false,
    });
  });

  it("adds structured reason codes for invalid JSON bodies", () => {
    const normalized = normalizeApiError(new SyntaxError("Unexpected token } in JSON at position 7"));

    expect(normalized.status).toBe(400);
    expect(normalized.message).toBe("Request body must be valid JSON.");
    expect(normalized.details).toMatchObject({
      reasonCode: "invalid_json_body",
      retryable: false,
      fieldHints: ["requestBody"],
    });
  });
});
