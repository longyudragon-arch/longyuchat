import type { ChatMessage, ModelRuntimeConfig, PersistedMessage } from "@/types/chat";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import { ApiError } from "@/server/http/api-error";
import type { ProviderErrorKind } from "@/server/http/provider-error";

export interface ConversationModel {
  modelId: string;
  sortOrder: number;
  config: ModelRuntimeConfig;
}

export interface SaveAssistantMessageInput {
  roomId: string;
  modelId: string;
  content: string;
}

export interface SequentialConversationInput {
  roomId: string;
  history: ChatMessage[];
  models: ConversationModel[];
  createAdapter: (config: ModelRuntimeConfig) => ModelAdapter;
  saveAssistantMessage: (input: SaveAssistantMessageInput) => Promise<PersistedMessage>;
}

export interface SequentialConversationResult {
  status: "completed" | "partial";
  messages: PersistedMessage[];
  failedModelId?: string;
  error?: string;
  providerErrorKind?: ProviderErrorKind;
  providerErrorDetails?: {
    finishReason?: string | null;
    attemptCount?: number | null;
    contentLength?: number | null;
    reasoningLength?: number | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    reasoningTokens?: number | null;
    initialFinishReason?: string | null;
    initialPromptTokens?: number | null;
    initialCompletionTokens?: number | null;
    initialReasoningTokens?: number | null;
  };
}

function extractProviderErrorKind(error: unknown) {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") {
    return undefined;
  }

  const providerErrorKind = (error.details as { providerErrorKind?: ProviderErrorKind }).providerErrorKind;
  return typeof providerErrorKind === "string" ? providerErrorKind : undefined;
}

function extractProviderErrorDetails(error: unknown) {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") {
    return undefined;
  }

  const details = error.details as Record<string, unknown>;

  return {
    finishReason: typeof details.finishReason === "string" ? details.finishReason : null,
    attemptCount: typeof details.attemptCount === "number" ? details.attemptCount : null,
    contentLength: typeof details.contentLength === "number" ? details.contentLength : null,
    reasoningLength: typeof details.reasoningLength === "number" ? details.reasoningLength : null,
    promptTokens: typeof details.promptTokens === "number" ? details.promptTokens : null,
    completionTokens: typeof details.completionTokens === "number" ? details.completionTokens : null,
    reasoningTokens: typeof details.reasoningTokens === "number" ? details.reasoningTokens : null,
    initialFinishReason: typeof details.initialFinishReason === "string" ? details.initialFinishReason : null,
    initialPromptTokens: typeof details.initialPromptTokens === "number" ? details.initialPromptTokens : null,
    initialCompletionTokens:
      typeof details.initialCompletionTokens === "number" ? details.initialCompletionTokens : null,
    initialReasoningTokens: typeof details.initialReasoningTokens === "number" ? details.initialReasoningTokens : null,
  };
}

function countVisibleCharacters(value: string) {
  return Array.from(value.trim()).length;
}

function normalizeMessageContent(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isUltraShortUserInput(value: string) {
  const normalized = normalizeMessageContent(value);

  if (!normalized) {
    return false;
  }

  return countVisibleCharacters(normalized) <= 3 || /^[\d\p{P}\p{S}\s]+$/u.test(normalized);
}

function truncateForInstruction(value: string, maxCharacters: number) {
  const normalized = normalizeMessageContent(value);
  const characters = Array.from(normalized);

  if (characters.length <= maxCharacters) {
    return normalized;
  }

  return `${characters.slice(0, maxCharacters).join("")}…`;
}

export function buildShortInputStabilityInstruction(history: ChatMessage[]): ChatMessage | null {
  const latestUserEntry = [...history]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "user");

  if (!latestUserEntry) {
    return null;
  }

  const latestUserMessage = latestUserEntry.message;

  if (!isUltraShortUserInput(latestUserMessage.content)) {
    return null;
  }

  const previousAnchorMessage = history
    .slice(0, latestUserEntry.index)
    .filter((message) => message.role === "user")
    .reverse()
    .find((message) => countVisibleCharacters(message.content) > 3);

  return {
    role: "system",
    content: previousAnchorMessage
      ? `本轮用户最新输入是「${truncateForInstruction(latestUserMessage.content, 24)}」，这是一个超短跟进输入。请把它视为对前文的延续，优先结合最近一条较完整的用户消息「${truncateForInstruction(previousAnchorMessage.content, 80)}」理解意图，并直接给出简体中文最终答案。不要只做澄清、不要保持沉默，也不要只输出思考过程。`
      : `本轮用户最新输入是「${truncateForInstruction(latestUserMessage.content, 24)}」，这是一个超短跟进输入。请把它视为对前文的延续，直接给出当前最合理的简体中文最终答案。不要只做澄清、不要保持沉默，也不要只输出思考过程。`,
  };
}

export function buildReplyLengthInstruction(config: ModelRuntimeConfig): ChatMessage {
  return {
    role: "system",
    content: `你必须直接给出可见的最终答案。默认使用简体中文回复；只有当用户明确要求其他语言时，才切换到对应语言。如果本轮用户输入很短、只有数字、符号，或像“1”“继续”“嗯”这样语言信息不足，也要结合更早的用户消息理解意图；如果仍然无法判断，就继续使用简体中文。最终答案必须控制在 ${config.defaultReplyLength} 个可见字符以内（含标点与空格）。如果初稿更长，请先压缩再回答，不要超过限制。`,
  };
}

export function buildParticipationInstruction(config: ModelRuntimeConfig): ChatMessage {
  return {
    role: "system",
    content: `你是 ${config.name}。请基于以上对话继续本轮多模型讨论，从你自己的视角直接回答。上文可能包含其他 AI 模型的回复，但你仍然必须给出自己的最终答案，不要保持沉默，也不要只输出思考过程。`,
  };
}

export async function runSequentialConversation(
  input: SequentialConversationInput,
): Promise<SequentialConversationResult> {
  const models = [...input.models].sort((left, right) => left.sortOrder - right.sortOrder);
  const history = [...input.history];
  const persistedMessages: PersistedMessage[] = [];

  for (const model of models) {
    try {
      const adapter = input.createAdapter(model.config);
      const shortInputInstruction = buildShortInputStabilityInstruction(history);
      const reply = await adapter.generateReply({
        config: model.config,
        messages: [
          buildReplyLengthInstruction(model.config),
          ...(shortInputInstruction ? [shortInputInstruction] : []),
          ...history,
          buildParticipationInstruction(model.config),
        ],
      });

      const savedMessage = await input.saveAssistantMessage({
        roomId: input.roomId,
        modelId: model.modelId,
        content: reply.content,
      });

      persistedMessages.push(savedMessage);
      history.push({
        role: savedMessage.role,
        content: savedMessage.content,
        modelId: savedMessage.modelId,
        sequence: savedMessage.sequence,
      });
    } catch (error) {
      return {
        status: "partial",
        messages: persistedMessages,
        failedModelId: model.modelId,
        error: error instanceof Error ? error.message : "Unknown error",
        providerErrorKind: extractProviderErrorKind(error),
        providerErrorDetails: extractProviderErrorDetails(error),
      };
    }
  }

  return {
    status: "completed",
    messages: persistedMessages,
  };
}
