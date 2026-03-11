import type { GenerateReplyInput, ModelAdapter, ModelReply } from "@/server/adapters/model-adapter";
import { requestProvider } from "@/server/http/provider-request";
import type { ModelRuntimeConfig } from "@/types/chat";

interface ChatCompletionChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractContent(payload: ChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" ? part.text ?? "" : ""))
      .join("")
      .trim();
  }

  throw new Error("The provider returned an empty response.");
}

function splitGraphemes(value: string) {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(value), (segment) => segment.segment);
  }

  return Array.from(value);
}

function countVisibleCharacters(content: string) {
  return splitGraphemes(content.trim()).length;
}

function enforceReplyLengthLimit(content: string, maxCharacters: number) {
  const normalized = content.trim();
  const graphemes = splitGraphemes(normalized);

  if (graphemes.length <= maxCharacters) {
    return normalized;
  }

  return graphemes.slice(0, maxCharacters).join("").trimEnd();
}

function buildEndpoint(config: ModelRuntimeConfig) {
  return `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
}

function formatProviderError(status: number, bodyText: string) {
  return `Provider request failed with ${status}: ${bodyText.slice(0, 600)}`;
}

function estimateMaxTokens(defaultReplyLength: number) {
  return Math.min(Math.max(Math.ceil(defaultReplyLength * 1.2), 64), 4096);
}

function estimateRewriteMaxTokens(defaultReplyLength: number) {
  return Math.min(Math.max(Math.ceil(defaultReplyLength), 64), 2048);
}

async function requestChatCompletion(
  config: ModelRuntimeConfig,
  messages: GenerateReplyInput["messages"],
  maxTokens: number,
) {
  const endpoint = buildEndpoint(config);
  const response = await requestProvider({
    url: endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(formatProviderError(response.status, response.bodyText));
  }

  const payload = JSON.parse(response.bodyText) as ChatCompletionResponse;
  const content = extractContent(payload);

  if (!content) {
    throw new Error("The provider returned an empty response.");
  }

  return {
    content,
    payload,
  };
}

function buildRewriteMessages(content: string, maxCharacters: number): GenerateReplyInput["messages"] {
  return [
    {
      role: "system",
      content: `Rewrite the assistant draft so the final answer keeps the same language, key meaning, and tone, but stays within ${maxCharacters} visible characters, including punctuation and spaces. Reply with the rewritten answer only.`,
    },
    {
      role: "user",
      content: `Draft to rewrite:\n${content}`,
    },
  ];
}

async function postChatCompletion(input: GenerateReplyInput): Promise<ModelReply> {
  const initialResult = await requestChatCompletion(
    input.config,
    input.messages,
    estimateMaxTokens(input.config.defaultReplyLength),
  );

  let content = initialResult.content;
  let rewritePayload: ChatCompletionResponse | null = null;

  if (countVisibleCharacters(content) > input.config.defaultReplyLength) {
    try {
      const rewrittenResult = await requestChatCompletion(
        input.config,
        buildRewriteMessages(content, input.config.defaultReplyLength),
        estimateRewriteMaxTokens(input.config.defaultReplyLength),
      );

      content = rewrittenResult.content;
      rewritePayload = rewrittenResult.payload;
    } catch {
      // Fall back to deterministic trimming if the compression pass fails.
    }
  }

  return {
    content: enforceReplyLengthLimit(content, input.config.defaultReplyLength),
    raw: rewritePayload
      ? {
          initial: initialResult.payload,
          rewrite: rewritePayload,
        }
      : initialResult.payload,
  };
}

export class OpenAiCompatibleAdapter implements ModelAdapter {
  async testConnection(config: ModelRuntimeConfig) {
    await postChatCompletion({
      config,
      messages: [{ role: "user", content: "ping" }],
    });
  }

  async generateReply(input: GenerateReplyInput) {
    return postChatCompletion(input);
  }
}

const openAiCompatibleProviders = new Set([
  "OPENAI_COMPATIBLE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
  "HUNYUAN",
  "QWEN",
]);

export function createModelAdapter(config: ModelRuntimeConfig): ModelAdapter {
  if (openAiCompatibleProviders.has(config.provider)) {
    return new OpenAiCompatibleAdapter();
  }

  throw new Error(`Provider ${config.provider} is not supported in the MVP yet.`);
}
