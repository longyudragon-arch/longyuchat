import type { GenerateReplyInput, ModelAdapter, ModelReply } from "@/server/adapters/model-adapter";
import { createProviderApiError, createProviderResponseApiError } from "@/server/http/provider-error";
import { requestProvider } from "@/server/http/provider-request";
import { getProviderExecutionProfile } from "@/lib/provider-catalog";
import type { ModelRuntimeConfig } from "@/types/chat";

interface ChatCompletionContentPart {
  type?: string;
  text?: string;
  content?: string;
}

interface ChatCompletionChoice {
  finish_reason?: string | null;
  message?: {
    content?: string | ChatCompletionContentPart[];
    reasoning_content?: string | ChatCompletionContentPart[];
    reasoning?: string | ChatCompletionContentPart[];
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
  output_text?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

interface NormalizedChatCompletion {
  content: string;
  reasoningContent: string;
  finishReason: string | null;
}

interface NormalizedUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
}

interface RequestChatCompletionResult {
  content: string;
  payload: ChatCompletionResponse;
  normalized: NormalizedChatCompletion;
  usage: NormalizedUsage;
  providerRequestDurationMs: number;
  providerAttemptCount: number;
  recoveryRequestDurationMs?: number | null;
  recoveryPayload?: ChatCompletionResponse;
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (!part || typeof part !== "object") {
        return "";
      }

      const record = part as ChatCompletionContentPart;

      if (typeof record.text === "string") {
        return record.text;
      }

      if (typeof record.content === "string") {
        return record.content;
      }

      return "";
    })
    .join("")
    .trim();
}

function normalizeChatCompletion(payload: ChatCompletionResponse): NormalizedChatCompletion {
  const firstChoice = payload.choices?.[0];
  const message = firstChoice?.message;
  const content = extractText(message?.content) || extractText(payload.output_text);
  const reasoningContent = extractText(message?.reasoning_content) || extractText(message?.reasoning);

  return {
    content,
    reasoningContent,
    finishReason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : null,
  };
}

function normalizeUsage(payload: ChatCompletionResponse): NormalizedUsage {
  return {
    promptTokens: typeof payload.usage?.prompt_tokens === "number" ? payload.usage.prompt_tokens : null,
    completionTokens: typeof payload.usage?.completion_tokens === "number" ? payload.usage.completion_tokens : null,
    reasoningTokens:
      typeof payload.usage?.completion_tokens_details?.reasoning_tokens === "number"
        ? payload.usage.completion_tokens_details.reasoning_tokens
        : null,
  };
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

export function resolveProviderRequestTimeoutMs(config: ModelRuntimeConfig) {
  return getProviderExecutionProfile(config).requestTimeoutMs;
}

function getLatestUserMessage(messages: GenerateReplyInput["messages"]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function isUltraShortFollowUp(content: string) {
  const normalized = content.trim();

  if (!normalized) {
    return false;
  }

  return countVisibleCharacters(normalized) <= 2 || /^[\d\p{P}\p{S}\s]+$/u.test(normalized);
}

function estimateMaxTokens(defaultReplyLength: number, messages: GenerateReplyInput["messages"]) {
  const latestUserMessage = getLatestUserMessage(messages);
  const multiplier = isUltraShortFollowUp(latestUserMessage) ? 1.8 : 1.2;
  const minimum = isUltraShortFollowUp(latestUserMessage) ? 128 : 64;

  return Math.min(Math.max(Math.ceil(defaultReplyLength * multiplier), minimum), 4096);
}

function estimateRetryMaxTokens(defaultReplyLength: number, messages: GenerateReplyInput["messages"]) {
  const latestUserMessage = getLatestUserMessage(messages);
  const multiplier = isUltraShortFollowUp(latestUserMessage) ? 3.2 : 2.4;
  const minimum = isUltraShortFollowUp(latestUserMessage) ? 384 : 256;

  return Math.min(Math.max(Math.ceil(defaultReplyLength * multiplier), minimum), 4096);
}

function estimateRewriteMaxTokens(defaultReplyLength: number) {
  return Math.min(Math.max(Math.ceil(defaultReplyLength), 64), 2048);
}

function buildRecoveryMessages(messages: GenerateReplyInput["messages"]): GenerateReplyInput["messages"] {
  return [
    {
      role: "system",
      content:
        "请直接输出可见的最终答案，并将最终答案放在 message.content 中。除非用户明确要求其他语言，否则默认使用简体中文。不要只返回思考过程，也不要让最终答案为空。",
    },
    ...messages,
  ];
}

function buildRewriteSystemInstruction(maxCharacters: number) {
  return `请改写下面这段助手草稿，保留原意和语气。除非用户明确要求其他语言，否则默认使用简体中文。最终答案必须控制在 ${maxCharacters} 个可见字符以内（含标点与空格）。只输出改写后的最终答案。`;
}

function shouldRetryWithoutFinalAnswer(
  normalized: NormalizedChatCompletion,
  executionProfile: ReturnType<typeof getProviderExecutionProfile>,
) {
  if (!executionProfile.allowsReasoningOnlyRetry) {
    return false;
  }

  return !normalized.content && Boolean(normalized.reasoningContent);
}

async function performChatCompletionRequest(
  config: ModelRuntimeConfig,
  messages: GenerateReplyInput["messages"],
  maxTokens: number,
  requestTimeoutMs: number,
) {
  const endpoint = buildEndpoint(config);
  const requestStartedAt = Date.now();
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
    timeoutMs: requestTimeoutMs,
  });

  if (!response.ok) {
    throw createProviderApiError({
      status: response.status,
      bodyText: response.bodyText,
      provider: config.provider,
      endpoint,
    });
  }

  let payload: ChatCompletionResponse;

  try {
    payload = JSON.parse(response.bodyText) as ChatCompletionResponse;
  } catch {
    throw new Error("The provider returned invalid JSON.");
  }

  return {
    endpoint,
    payload,
    normalized: normalizeChatCompletion(payload),
    usage: normalizeUsage(payload),
    durationMs: Date.now() - requestStartedAt,
  };
}

async function requestChatCompletion(
  config: ModelRuntimeConfig,
  messages: GenerateReplyInput["messages"],
  maxTokens: number,
  executionProfile: ReturnType<typeof getProviderExecutionProfile>,
): Promise<RequestChatCompletionResult> {
  const initial = await performChatCompletionRequest(config, messages, maxTokens, executionProfile.requestTimeoutMs);

  if (initial.normalized.content) {
    return {
      content: initial.normalized.content,
      payload: initial.payload,
      normalized: initial.normalized,
      usage: initial.usage,
      providerRequestDurationMs: initial.durationMs,
      providerAttemptCount: 1,
    };
  }

  if (!shouldRetryWithoutFinalAnswer(initial.normalized, executionProfile)) {
    throw createProviderResponseApiError({
      provider: config.provider,
      endpoint: initial.endpoint,
      kind: initial.normalized.reasoningContent ? "reasoning_only" : "empty_response",
      finishReason: initial.normalized.finishReason,
      attemptCount: 1,
      contentLength: initial.normalized.content.length,
      reasoningLength: initial.normalized.reasoningContent.length,
      promptTokens: initial.usage.promptTokens,
      completionTokens: initial.usage.completionTokens,
      reasoningTokens: initial.usage.reasoningTokens,
    });
  }

  const recovery = await performChatCompletionRequest(
    config,
    buildRecoveryMessages(messages),
    Math.max(maxTokens, estimateRetryMaxTokens(config.defaultReplyLength, messages)),
    executionProfile.requestTimeoutMs,
  );

  if (!shouldRetryWithoutFinalAnswer(recovery.normalized, executionProfile)) {
    return {
      content: recovery.normalized.content,
      payload: recovery.payload,
      normalized: recovery.normalized,
      usage: recovery.usage,
      providerRequestDurationMs: initial.durationMs + recovery.durationMs,
      providerAttemptCount: 2,
      recoveryRequestDurationMs: recovery.durationMs,
      recoveryPayload: initial.payload,
    };
  }

  throw createProviderResponseApiError({
    provider: config.provider,
    endpoint: initial.endpoint,
    kind: recovery.normalized.reasoningContent ? "reasoning_only" : "empty_response",
    finishReason: recovery.normalized.finishReason ?? initial.normalized.finishReason,
    attemptCount: 2,
    contentLength: recovery.normalized.content.length,
    reasoningLength: recovery.normalized.reasoningContent.length,
    promptTokens: recovery.usage.promptTokens,
    completionTokens: recovery.usage.completionTokens,
    reasoningTokens: recovery.usage.reasoningTokens,
    initialFinishReason: initial.normalized.finishReason,
    initialPromptTokens: initial.usage.promptTokens,
    initialCompletionTokens: initial.usage.completionTokens,
    initialReasoningTokens: initial.usage.reasoningTokens,
  });
}

function buildRewriteMessages(content: string, maxCharacters: number): GenerateReplyInput["messages"] {
  return [
    {
      role: "system",
      content: buildRewriteSystemInstruction(maxCharacters),
    },
    {
      role: "user",
      content: `待改写草稿：\n${content}`,
    },
  ];
}

async function postChatCompletion(input: GenerateReplyInput): Promise<ModelReply> {
  const executionProfile = getProviderExecutionProfile(input.config);
  const initialResult = await requestChatCompletion(
    input.config,
    input.messages,
    estimateMaxTokens(input.config.defaultReplyLength, input.messages),
    executionProfile,
  );

  let content = initialResult.content;
  let rewritePayload: ChatCompletionResponse | null = null;
  let providerRequestDurationMs = initialResult.providerRequestDurationMs;
  let providerAttemptCount = initialResult.providerAttemptCount;
  const recoveryRequestDurationMs = initialResult.recoveryRequestDurationMs ?? null;
  let rewriteRequestDurationMs: number | null = null;

  if (executionProfile.allowsReplyRewritePass && countVisibleCharacters(content) > input.config.defaultReplyLength) {
    try {
      const rewrittenResult = await requestChatCompletion(
        input.config,
        buildRewriteMessages(content, input.config.defaultReplyLength),
        estimateRewriteMaxTokens(input.config.defaultReplyLength),
        executionProfile,
      );

      content = rewrittenResult.content;
      rewritePayload = rewrittenResult.payload;
      providerRequestDurationMs += rewrittenResult.providerRequestDurationMs;
      providerAttemptCount += rewrittenResult.providerAttemptCount;
      rewriteRequestDurationMs = rewrittenResult.providerRequestDurationMs;
    } catch {
      // Fall back to deterministic trimming if the compression pass fails.
    }
  }

  return {
    content: enforceReplyLengthLimit(content, input.config.defaultReplyLength),
    raw: rewritePayload
      ? {
          initial: initialResult.recoveryPayload
            ? {
                firstAttempt: initialResult.recoveryPayload,
                recoveredAttempt: initialResult.payload,
              }
            : initialResult.payload,
          rewrite: rewritePayload,
        }
      : initialResult.recoveryPayload
        ? {
            firstAttempt: initialResult.recoveryPayload,
            recoveredAttempt: initialResult.payload,
          }
        : initialResult.payload,
    replyTiming: {
      queueDurationMs: null,
      providerRequestDurationMs,
      providerAttemptCount,
      recoveryRequestDurationMs,
      rewriteRequestDurationMs,
      persistenceDurationMs: null,
    },
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
