import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "@/generated/prisma/client";
import {
  deleteModelConfig,
  testModelConnectionById,
  toModelRuntimeConfig,
} from "@/server/services/model-config-service";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import { ApiError } from "@/server/http/api-error";
import { encryptModelSecret } from "@/server/security/model-secret-crypto";
import type { ModelRuntimeConfig } from "@/types/chat";

function buildModel(id: string): ModelConfig {
  return {
    id,
    name: `Model ${id}`,
    provider: "OPENAI_COMPATIBLE",
    baseUrl: "https://example.com/v1",
    modelName: "gpt-test",
    apiKey: "secret-key",
    defaultReplyLength: 300,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
    enabled: true,
    createdAt: new Date("2026-03-11T00:00:00.000Z"),
    updatedAt: new Date("2026-03-11T00:00:00.000Z"),
  };
}

describe("testModelConnectionById", () => {
  afterEach(() => {
    delete process.env.MODEL_SECRET_ENCRYPTION_KEY;
  });

  it("persists the latest successful test result", async () => {
    const persistedModel = {
      ...buildModel("model-1"),
      lastTestStatus: "SUCCESS" as const,
      lastTestMessage: "Connection test succeeded.",
      lastTestedAt: new Date("2026-03-11T08:00:00.000Z"),
    };
    const persistTestResult = vi.fn(async () => persistedModel);
    const testConnection = vi.fn(async () => undefined);

    const result = await testModelConnectionById("model-1", {
      getModelById: async () => buildModel("model-1"),
      persistTestResult,
      createAdapter: (config: ModelRuntimeConfig): ModelAdapter => {
        void config;

        return {
          testConnection,
          generateReply: vi.fn(),
        };
      },
    });

    expect(testConnection).toHaveBeenCalledTimes(1);
    expect(persistTestResult).toHaveBeenCalledWith(
      "model-1",
      expect.objectContaining({
        status: "SUCCESS",
        message: "Connection test succeeded.",
      }),
    );
    expect(result.lastTestStatus).toBe("SUCCESS");
  });

  it("persists the latest failed test result before rethrowing", async () => {
    const persistTestResult = vi.fn(async () => ({
      ...buildModel("model-2"),
      lastTestStatus: "ERROR" as const,
      lastTestMessage: "Provider timeout",
      lastTestedAt: new Date("2026-03-11T09:00:00.000Z"),
    }));
    const failure = new Error("Provider timeout");

    await expect(
      testModelConnectionById("model-2", {
        getModelById: async () => buildModel("model-2"),
        persistTestResult,
        createAdapter: (): ModelAdapter => ({
          testConnection: vi.fn(async () => {
            throw failure;
          }),
          generateReply: vi.fn(),
        }),
      }),
    ).rejects.toThrow("Provider timeout");

    expect(persistTestResult).toHaveBeenCalledWith(
      "model-2",
      expect.objectContaining({
        status: "ERROR",
        message: "Provider timeout",
      }),
    );
  });

  it("also persists unsupported-provider failures", async () => {
    const persistTestResult = vi.fn(async () => ({
      ...buildModel("model-3"),
      lastTestStatus: "ERROR" as const,
      lastTestMessage: "Provider CLAUDE is not supported in the MVP yet.",
      lastTestedAt: new Date("2026-03-11T10:00:00.000Z"),
    }));

    await expect(
      testModelConnectionById("model-3", {
        getModelById: async () => ({
          ...buildModel("model-3"),
          provider: "CLAUDE",
        }),
        persistTestResult,
        createAdapter: () => {
          throw new Error("Provider CLAUDE is not supported in the MVP yet.");
        },
      }),
    ).rejects.toThrow("Provider CLAUDE is not supported in the MVP yet.");

    expect(persistTestResult).toHaveBeenCalledWith(
      "model-3",
      expect.objectContaining({
        status: "ERROR",
        message: "Provider CLAUDE is not supported in the MVP yet.",
      }),
    );
  });

  it("decrypts encrypted API keys before building runtime config", () => {
    const encryptionKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");
    process.env.MODEL_SECRET_ENCRYPTION_KEY = encryptionKey;
    const encryptedApiKey = encryptModelSecret("secret-key", encryptionKey);

    const runtimeConfig = toModelRuntimeConfig({
      ...buildModel("model-4"),
      apiKey: encryptedApiKey,
    });

    expect(runtimeConfig.apiKey).toBe("secret-key");
  });
});

describe("deleteModelConfig", () => {
  it("blocks deleting a model that is still used by chat rooms", async () => {
    await expect(
      deleteModelConfig("model-in-use", {
        getModelById: async () => ({ id: "model-in-use", name: "Gemini 主模型" }),
        getReferencingRooms: async () => [
          { id: "room-1", title: "产品讨论群", type: "GROUP" },
          { id: "room-2", title: "单聊测试", type: "SINGLE" },
        ],
        deleteById: vi.fn(),
      }),
    ).rejects.toMatchObject<ApiError>({
      status: 409,
      message: "Model Gemini 主模型 is still used by 2 chat room(s).",
      details: {
        modelId: "model-in-use",
        modelName: "Gemini 主模型",
        roomCount: 2,
      },
    });
  });

  it("deletes a model when no chat room references remain", async () => {
    const deletedModel = buildModel("model-free");
    const deleteById = vi.fn(async () => deletedModel);

    const result = await deleteModelConfig("model-free", {
      getModelById: async () => ({ id: "model-free", name: "可删除模型" }),
      getReferencingRooms: async () => [],
      deleteById,
    });

    expect(deleteById).toHaveBeenCalledWith("model-free");
    expect(result).toEqual(deletedModel);
  });
});
