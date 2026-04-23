import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProviderConnection } from "@/generated/prisma/client";
import {
  deleteProviderConnection,
  discoverModelsByConnectionId,
  resolveProviderConnectionDiscoveryStrategy,
  testProviderConnectionById,
  updateProviderConnection,
} from "@/server/services/provider-connection-service";
import { ApiError } from "@/server/http/api-error";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import type { ModelRuntimeConfig } from "@/types/chat";

function buildConnection(
  id: string,
  overrides: Partial<ProviderConnection> = {},
): ProviderConnection {
  return {
    id,
    name: `Connection ${id}`,
    provider: "OPENAI_COMPATIBLE",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "secret-key",
    discoveryStrategy: "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    enabled: true,
    lastAuthStatus: null,
    lastAuthMessage: null,
    lastAuthCheckedAt: null,
    lastDiscoveryStatus: null,
    lastDiscoveryMessage: null,
    lastDiscoveredAt: null,
    createdAt: new Date("2026-03-25T00:00:00.000Z"),
    updatedAt: new Date("2026-03-25T00:00:00.000Z"),
    ...overrides,
  };
}

describe("resolveProviderConnectionDiscoveryStrategy", () => {
  it("defaults to auto-fetch with manual fallback for compatible providers", () => {
    expect(resolveProviderConnectionDiscoveryStrategy("GEMINI", undefined)).toBe(
      "AUTO_FETCH_WITH_MANUAL_FALLBACK",
    );
  });

  it("defaults to manual-only for providers without discovery support", () => {
    expect(resolveProviderConnectionDiscoveryStrategy("CLAUDE", undefined)).toBe("MANUAL_ONLY");
  });

  it("rejects incompatible auto-discovery strategies for unsupported providers", () => {
    expect(() =>
      resolveProviderConnectionDiscoveryStrategy("CLAUDE", "AUTO_FETCH_WITH_MANUAL_FALLBACK"),
    ).toThrow("Provider CLAUDE does not support automatic model discovery yet.");
  });
});

describe("testProviderConnectionById", () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.MODEL_SECRET_ENCRYPTION_KEY;
  });

  it("uses an auth probe model instead of discovery for auto-discoverable providers", async () => {
    const persistAuthResult = vi.fn(async () => buildConnection("conn-1"));
    const discoverProviderModels = vi.fn(async () => {
      throw new Error("discovery should not run during auth testing");
    });
    const testConnection = vi.fn(async () => undefined);

    const result = await testProviderConnectionById(
      "conn-1",
      {},
      {
        getConnectionById: async () => buildConnection("conn-1", { provider: "GEMINI" }),
        persistAuthResult,
        discoverProviderModels,
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          expect(config.modelName).toBe("gemini-2.5-flash");

          return {
            testConnection,
            generateReply: vi.fn(),
          };
        },
      },
    );

    expect(testConnection).toHaveBeenCalledTimes(1);
    expect(discoverProviderModels).not.toHaveBeenCalled();
    expect(persistAuthResult).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        status: "SUCCESS",
        message: "Connection test succeeded with probe model gemini-2.5-flash.",
      }),
    );
    expect(result.id).toBe("conn-1");
  });

  it("requires a probe model name when neither template nor provider supplies a default probe", async () => {
    const persistAuthResult = vi.fn(async () => buildConnection("conn-2"));

    await expect(
      testProviderConnectionById(
        "conn-2",
        {},
        {
          getConnectionById: async () =>
            buildConnection("conn-2", {
              provider: "CLAUDE",
              baseUrl: "https://api.anthropic.com/v1",
              discoveryStrategy: "MANUAL_ONLY",
            }),
          persistAuthResult,
          discoverProviderModels: vi.fn(),
          createAdapter: vi.fn(),
        },
      ),
    ).rejects.toMatchObject<ApiError>({
      status: 400,
      message:
        "Provider CLAUDE requires a model ID to test the connection. Please provide a probe model name.",
      details: expect.objectContaining({
        reasonCode: "provider_connection_probe_model_required",
        fieldHints: ["modelName", "providerTemplate"],
      }),
    });

    expect(persistAuthResult).toHaveBeenCalledWith(
      "conn-2",
      expect.objectContaining({
        status: "ERROR",
      }),
    );
  });

  it("can probe manual-only providers through the adapter when a model name is supplied", async () => {
    const persistAuthResult = vi.fn(async () => buildConnection("conn-3"));
    const testConnection = vi.fn(async () => undefined);

    await testProviderConnectionById(
      "conn-3",
      { modelName: "hunyuan-turbo" },
      {
        getConnectionById: async () =>
          buildConnection("conn-3", {
            provider: "HUNYUAN",
            discoveryStrategy: "MANUAL_ONLY",
            baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
          }),
        persistAuthResult,
        discoverProviderModels: vi.fn(),
        createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
          expect(config.modelName).toBe("hunyuan-turbo");

          return {
            testConnection,
            generateReply: vi.fn(),
          };
        },
      },
    );

    expect(testConnection).toHaveBeenCalledTimes(1);
    expect(persistAuthResult).toHaveBeenCalledWith(
      "conn-3",
      expect.objectContaining({
        status: "SUCCESS",
      }),
    );
  });

  it("rejects plaintext stored provider API keys in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.MODEL_SECRET_ENCRYPTION_KEY = Buffer.from(
      "0123456789abcdef0123456789abcdef",
      "utf8",
    ).toString("base64");

    await expect(
      testProviderConnectionById(
        "conn-plain",
        {},
        {
          getConnectionById: async () => buildConnection("conn-plain", { apiKey: "legacy-plain-key" }),
          persistAuthResult: vi.fn(async () => buildConnection("conn-plain")),
          discoverProviderModels: vi.fn(),
          createAdapter: vi.fn(),
        },
      ),
    ).rejects.toThrow("Stored model secret must be encrypted before running in production.");
  });
});

describe("discoverModelsByConnectionId", () => {
  it("rejects connections configured for manual model entry only", async () => {
    await expect(
      discoverModelsByConnectionId("conn-4", {
        getConnectionById: async () =>
          buildConnection("conn-4", {
            provider: "HUNYUAN",
            discoveryStrategy: "MANUAL_ONLY",
          }),
        persistDiscoveryResult: vi.fn(),
        discoverProviderModels: vi.fn(),
      }),
    ).rejects.toMatchObject<ApiError>({
      status: 400,
      message: "Provider connection Connection conn-4 is configured for manual model entry only.",
      details: expect.objectContaining({
        reasonCode: "provider_connection_manual_only",
        fieldHints: ["discoveryStrategy", "modelName"],
      }),
    });
  });
});

describe("deleteProviderConnection", () => {
  it("blocks deleting a provider connection that is still referenced by models", async () => {
    await expect(
      deleteProviderConnection("conn-5", {
        getConnectionById: async () => ({ id: "conn-5", name: "Gemini 主连接" }),
        getReferencingModels: async () => [
          { id: "model-1", name: "Gemini 主模型", enabled: true },
          { id: "model-2", name: "Gemini 备用模型", enabled: false },
        ],
        deleteById: vi.fn(),
      }),
    ).rejects.toMatchObject<ApiError>({
      status: 409,
      message: "Provider connection Gemini 主连接 is still used by 2 model(s).",
      details: expect.objectContaining({
        reasonCode: "provider_connection_in_use",
        connectionId: "conn-5",
        connectionName: "Gemini 主连接",
        modelCount: 2,
      }),
    });
  });
});

describe("updateProviderConnection", () => {
  it("syncs linked model connection fields when the provider connection changes", async () => {
    const updateConnectionAndLinkedModels = vi.fn(async () => ({
      ...buildConnection("conn-6", {
        provider: "GEMINI",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: "encrypted-connection-key",
      }),
      _count: {
        models: 2,
      },
    }));

    const result = await updateProviderConnection(
      "conn-6",
      {
        provider: "GEMINI",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: "new-secret-key",
      },
      {
        getConnectionById: async () => buildConnection("conn-6"),
        updateConnectionAndLinkedModels,
      },
    );

    expect(updateConnectionAndLinkedModels).toHaveBeenCalledWith(
      "conn-6",
      expect.objectContaining({
        syncLinkedModels: expect.objectContaining({
          provider: "GEMINI",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        }),
      }),
    );
    expect(result._count.models).toBe(2);
  });
});
