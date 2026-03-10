import { describe, expect, it, vi } from "vitest";

import { discoverProviderModels } from "@/server/services/model-discovery-service";

describe("discoverProviderModels", () => {
  it("loads and normalizes OpenAI-compatible model lists", async () => {
    const requestProvider = vi.fn(async () => ({
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        object: "list",
        data: [
          {
            id: "gpt-4.1-mini",
            owned_by: "openai",
          },
          {
            id: "gpt-4.1",
            owned_by: "openai",
          },
        ],
      }),
      transport: "fetch" as const,
    }));

    const models = await discoverProviderModels(
      {
        provider: "OPENAI_COMPATIBLE",
        baseUrl: "https://api.openai.com/v1/",
        apiKey: "secret-key",
      },
      { requestProvider },
    );

    expect(requestProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.openai.com/v1/models",
        method: "GET",
      }),
    );
    expect(models).toEqual([
      {
        id: "gpt-4.1",
        label: "gpt-4.1",
        description: "openai",
      },
      {
        id: "gpt-4.1-mini",
        label: "gpt-4.1-mini",
        description: "openai",
      },
    ]);
  });

  it("supports provider-specific compatible endpoints like Doubao", async () => {
    const requestProvider = vi.fn(async () => ({
      ok: true,
      status: 200,
      bodyText: JSON.stringify({
        data: [
          {
            id: "doubao-seed-1-6",
            type: "chat",
          },
        ],
      }),
      transport: "fetch" as const,
    }));

    const models = await discoverProviderModels(
      {
        provider: "DOUBAO",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        apiKey: "secret-key",
      },
      { requestProvider },
    );

    expect(models).toEqual([
      {
        id: "doubao-seed-1-6",
        label: "doubao-seed-1-6",
        description: "chat",
      },
    ]);
  });

  it("rejects unsupported providers that do not have discovery yet", async () => {
    await expect(
      discoverProviderModels(
        {
          provider: "CLAUDE",
          baseUrl: "https://api.anthropic.com/v1",
          apiKey: "secret-key",
        },
        { requestProvider: vi.fn() },
      ),
    ).rejects.toThrow("Automatic model discovery for CLAUDE is not available yet.");
  });
});
