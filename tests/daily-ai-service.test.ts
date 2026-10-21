import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ reply: vi.fn(), list: vi.fn() }));
vi.mock("@/server/adapters/openai-compatible-adapter", () => ({ createModelAdapter: () => ({ generateReply: mocks.reply }) }));
vi.mock("@/server/services/daily-config-service", () => ({ getAiDailyModelId: () => null, getAiDailyGenerationTimeoutMs: () => 5000 }));
vi.mock("@/server/services/model-config-service", () => ({
  getModelConfigById: vi.fn(), listModelConfigs: mocks.list,
  toModelRuntimeConfig: () => ({ defaultReplyLength: 1000 }),
}));

import { generateAiDailyJson } from "@/server/services/daily-ai-service";

const input = { system: "Return a draft", user: "Synthetic input", schema: z.object({ title: z.string().min(1), items: z.array(z.object({ content: z.string() })).min(1) }) };

beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([{ enabled: true }]); });

describe("daily AI structured output", () => {
  it("accepts valid fenced JSON and returns schema parsed output", async () => {
    mocks.reply.mockResolvedValue({ content: '```json\n{"title":"日报","items":[{"content":"内容"}],"extra":"discard"}\n```' });
    await expect(generateAiDailyJson(input)).resolves.toEqual({ title: "日报", items: [{ content: "内容" }] });
  });

  it.each(['{"title":123,"items":[]}', '{"title":"日报","items":[{"content":false}]}', 'not json']) (
    "rejects malformed or invalid JSON without exposing raw provider content: %s", async (content) => {
      mocks.reply.mockResolvedValue({ content });
      await expect(generateAiDailyJson(input)).rejects.toMatchObject({ status: 502, message: "AI daily model returned JSON that does not match the required structure." });
    },
  );

  it("returns null without calling a provider when no model is enabled", async () => {
    mocks.list.mockResolvedValue([]);
    await expect(generateAiDailyJson(input)).resolves.toBeNull();
    expect(mocks.reply).not.toHaveBeenCalled();
  });
});
