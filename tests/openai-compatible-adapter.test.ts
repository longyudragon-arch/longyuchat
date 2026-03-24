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

describe("OpenAiCompatibleAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tests connectivity through the OpenAI-compatible chat completions endpoint", async () => {
    const json = vi.fn(async () => ({
      choices: [{ message: { content: "pong" } }],
    }));

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json,
    }));

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
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
    }));

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    const result = await adapter.generateReply({
      config: runtimeConfig,
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(result.content).toBe("Hello world");
  });

  it("requests a compression rewrite before returning an overlong reply", async () => {
    const shortConfig: ModelRuntimeConfig = {
      ...runtimeConfig,
      defaultReplyLength: 5,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "你好，世界，欢迎你",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "你好呀",
              },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    const result = await adapter.generateReply({
      config: shortConfig,
      messages: [{ role: "user", content: "打个招呼" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("你好呀");

    const rewritePayload = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(rewritePayload.max_tokens).toBe(64);
    expect(rewritePayload.messages).toEqual([
      {
        role: "system",
        content:
          "Rewrite the assistant draft so the final answer keeps the same language, key meaning, and tone, but stays within 5 visible characters, including punctuation and spaces. Reply with the rewritten answer only.",
      },
      {
        role: "user",
        content: "Draft to rewrite:\n你好，世界，欢迎你",
      },
    ]);
  });

  it("falls back to hard trimming when the compression pass is still too long", async () => {
    const shortConfig: ModelRuntimeConfig = {
      ...runtimeConfig,
      defaultReplyLength: 5,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "你好，世界，欢迎你",
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "你好，世界，继续欢迎你",
              },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenAiCompatibleAdapter();
    const result = await adapter.generateReply({
      config: shortConfig,
      messages: [{ role: "user", content: "打个招呼" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("你好，世界");
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

  it("surfaces upstream Gemini API key failures as authentication errors", async () => {
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
