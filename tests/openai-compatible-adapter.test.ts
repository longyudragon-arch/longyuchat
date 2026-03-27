import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAiCompatibleAdapter, createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import type { ModelRuntimeConfig } from "@/types/chat";

const runtimeConfig: ModelRuntimeConfig = {
  id: "model-1",
  name: "Primary",
  provider: "OPENAI_COMPATIBLE",
  baseUrl: "https://example.com/v1/",
  modelName: "gpt-test",
  apiKey: "secret-key",
  defaultReplyLength: 300,
};

function createSuccessResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
}

describe("OpenAiCompatibleAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tests connectivity through the OpenAI-compatible chat completions endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      createSuccessResponse({
        choices: [{ message: { content: "pong" } }],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    await adapter.testConnection(runtimeConfig);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(payload).toEqual({
      model: "gpt-test",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 360,
    });
  });

  it("normalizes rich content arrays into a single text reply", async () => {
    const fetchMock = vi.fn(async () =>
      createSuccessResponse({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "Hello" },
                { type: "text", text: " world" },
              ],
            },
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    const result = await adapter.generateReply({
      config: runtimeConfig,
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(result.content).toBe("Hello world");
  });

  it("rewrites overly long replies with the Chinese default-language instruction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createSuccessResponse({
          choices: [
            {
              message: {
                content: "这是一段明显超过限制的回复，需要再次压缩。".repeat(30),
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createSuccessResponse({
          choices: [
            {
              message: {
                content: "压缩后的中文回复",
              },
            },
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    const result = await adapter.generateReply({
      config: {
        ...runtimeConfig,
        defaultReplyLength: 20,
      },
      messages: [{ role: "user", content: "请简短回答" }],
    });

    expect(result.content).toBe("压缩后的中文回复");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const rewritePayload = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(rewritePayload.messages[0]?.content).toContain("默认使用简体中文");
    expect(rewritePayload.messages[1]?.content).toContain("待改写草稿");
  });

  it("allocates a larger token budget for ultra-short numeric follow-up inputs", async () => {
    const fetchMock = vi.fn(async () =>
      createSuccessResponse({
        choices: [{ message: { content: "收到" } }],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    await adapter.generateReply({
      config: runtimeConfig,
      messages: [{ role: "user", content: "1" }],
    });

    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(payload.max_tokens).toBeGreaterThan(360);
  });

  it("retries once when the provider only returns reasoning content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createSuccessResponse({
          choices: [
            {
              finish_reason: "length",
              message: {
                content: "",
                reasoning_content: "internal reasoning",
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createSuccessResponse({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: "Recovered final answer",
              },
            },
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    const result = await adapter.generateReply({
      config: runtimeConfig,
      messages: [{ role: "user", content: "Continue" }],
    });

    expect(result.content).toBe("Recovered final answer");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryPayload = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(retryPayload.max_tokens).toBeGreaterThan(360);
    expect(retryPayload.messages[0]?.content).toContain("默认使用简体中文");
  });

  it("throws a structured provider error after retry still has no final answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createSuccessResponse({
          choices: [
            {
              finish_reason: "length",
              message: {
                content: "",
                reasoning_content: "first reasoning",
              },
            },
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 0,
            completion_tokens_details: {
              reasoning_tokens: 18,
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createSuccessResponse({
          choices: [
            {
              finish_reason: "length",
              message: {
                content: "",
                reasoning_content: "second reasoning",
              },
            },
          ],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 0,
            completion_tokens_details: {
              reasoning_tokens: 22,
            },
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();

    await expect(
      adapter.generateReply({
        config: runtimeConfig,
        messages: [{ role: "user", content: "Continue" }],
      }),
    ).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("reasoning content but no final answer"),
      details: expect.objectContaining({
        providerErrorKind: "reasoning_only",
        attemptCount: 2,
        completionTokens: 0,
        reasoningTokens: 22,
        initialCompletionTokens: 0,
        initialReasoningTokens: 18,
      }),
    });
  });

  it("reuses the OpenAI-compatible adapter for compatible providers", () => {
    const providerConfigs = [
      {
        provider: "GEMINI",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      },
      {
        provider: "MODELSCOPE",
        baseUrl: "https://api-inference.modelscope.cn/v1",
      },
      {
        provider: "DOUBAO",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      },
      {
        provider: "HUNYUAN",
        baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
      },
      {
        provider: "QWEN",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
    ] as const;

    for (const config of providerConfigs) {
      const adapter = createModelAdapter({
        ...runtimeConfig,
        provider: config.provider,
        baseUrl: config.baseUrl,
        modelName: "test-model",
      });

      expect(adapter).toBeInstanceOf(OpenAiCompatibleAdapter);
    }
  });

  it("surfaces upstream API key failures as authentication errors", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify([
          {
            error: {
              code: 400,
              message: "API Key not found. Please pass a valid API key.",
              status: "INVALID_ARGUMENT",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                  reason: "API_KEY_INVALID",
                  domain: "googleapis.com",
                },
              ],
            },
          },
        ]),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();

    await expect(
      adapter.generateReply({
        config: {
          ...runtimeConfig,
          provider: "GEMINI",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
          modelName: "gemini-2.5-flash",
        },
        messages: [{ role: "user", content: "Hello" }],
      }),
    ).rejects.toThrow(/Provider authentication failed with 400:/);
  });
});
