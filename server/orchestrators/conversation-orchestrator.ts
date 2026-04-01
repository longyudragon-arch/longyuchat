import type {
  ChatMessage,
  ConversationHistoryMessage,
  ModelRuntimeConfig,
  PersistedMessage,
  ReplyTimingDetails,
} from "@/types/chat";
import type { ModelAdapter } from "@/server/adapters/model-adapter";
import { ApiError } from "@/server/http/api-error";
import type { ProviderErrorKind } from "@/server/http/provider-error";
import {
  getConversationHistoryContextTokenBudget,
  getConversationHistoryWindowBeforeLatestUserMessages,
} from "@/lib/runtime";

export interface ConversationModel {
  modelId: string;
  sortOrder: number;
  config: ModelRuntimeConfig;
}

export interface SaveAssistantMessageInput {
  roomId: string;
  modelId: string;
  content: string;
  replyDurationMs: number;
  replyTiming?: ReplyTimingDetails | null;
}

export interface SequentialConversationInput {
  roomId: string;
  history: ConversationHistoryMessage[];
  models: ConversationModel[];
  createAdapter: (config: ModelRuntimeConfig) => ModelAdapter;
  saveAssistantMessage: (input: SaveAssistantMessageInput) => Promise<PersistedMessage>;
  onModelStart?: (input: {
    roomId: string;
    modelId: string;
    sortOrder: number;
  }) => Promise<void> | void;
  onModelReplied?: (input: {
    roomId: string;
    modelId: string;
    sortOrder: number;
    message: PersistedMessage;
  }) => Promise<void> | void;
  onModelFailed?: (input: {
    roomId: string;
    modelId: string;
    sortOrder: number;
    error: string;
    providerErrorKind?: ProviderErrorKind;
    providerErrorDetails?: SequentialConversationModelOutcome["providerErrorDetails"];
  }) => Promise<void> | void;
}

export interface SequentialConversationModelOutcome {
  modelId: string;
  outcome: "replied" | "failed";
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

export interface SequentialConversationResult {
  status: "completed" | "partial";
  messages: PersistedMessage[];
  roundOutcomes: SequentialConversationModelOutcome[];
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

export function buildShortInputStabilityInstruction(history: ConversationHistoryMessage[]): ChatMessage | null {
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
    content: `你当前在房间中的身份是：显示名称「${config.name}」、供应商「${config.provider}」、模型标识「${config.modelName}」。这是一个多模型顺序讨论房间。上文中其他模型的发言只作为参考资料，不代表你的身份、立场或你之前已经说过的话；只有明确属于你自己的历史回复，才可以视为你的既有表态。请始终从你自己的视角直接回答，不要自称为其他模型，不要继承其他模型的身份，也不要只输出思考过程。`,
  };
}

export function buildParticipantRosterInstruction(models: ConversationModel[], currentModel: ConversationModel): ChatMessage {
  const participantLines = [...models]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((model) => {
      const marker = model.modelId === currentModel.modelId ? "（当前轮到你）" : "";
      return `${model.sortOrder}. ${model.config.name} [${model.config.provider} / ${model.config.modelName}]${marker}`;
    });

  return {
    role: "system",
    content: `当前房间参与模型顺序如下：\n${participantLines.join("\n")}\n请注意区分不同模型的发言归属。除非消息明确标注为你自己的历史回复，否则都只视为参考上下文。`,
  };
}

function buildSpeakerLabel(message: ConversationHistoryMessage) {
  const primary = message.speakerName?.trim() || message.speakerModelName?.trim() || message.modelId?.trim() || "未知模型";

  if (message.speakerModelName && message.speakerName && message.speakerModelName !== message.speakerName) {
    return `${message.speakerName}（${message.speakerModelName}）`;
  }

  return primary;
}

function formatCrossModelReference(message: ConversationHistoryMessage): ChatMessage {
  const speakerLabel = buildSpeakerLabel(message);
  const providerLabel = message.speakerProvider ? `，供应商为「${message.speakerProvider}」` : "";

  return {
    role: "system",
    content: `以下是房间中其他模型「${speakerLabel}」的参考发言${providerLabel}。这不是你自己的历史回复，也不代表你的身份或既有立场，请仅作为参考：\n${message.content}`,
  };
}

function toContextMessage(message: ConversationHistoryMessage, currentModel: ConversationModel): ChatMessage {
  if (message.role !== "assistant") {
    return {
      role: message.role,
      content: message.content,
    };
  }

  if (message.modelId && message.modelId === currentModel.modelId) {
    return {
      role: "assistant",
      content: message.content,
    };
  }

  return formatCrossModelReference(message);
}

function findLatestUserMessageIndex(history: ConversationHistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.role === "user") {
      return index;
    }
  }

  return -1;
}

function estimateTextTokens(value: string) {
  const visibleCharacters = Array.from(value.trim()).length;
  return Math.max(1, visibleCharacters + 8);
}

function estimateMessageTokens(message: ChatMessage) {
  const roleOverhead = message.role === "system" ? 12 : 6;
  return estimateTextTokens(message.content) + roleOverhead;
}

function buildContextWindowInstruction(trimmedMessageCount: number): ChatMessage {
  return {
    role: "system",
    content: `为控制上下文长度，更早的 ${trimmedMessageCount} 条历史消息已被省略。请优先依据以下保留下来的最近上下文继续回答。`,
  };
}

function buildScopedContextMessages(history: ConversationHistoryMessage[], currentModel: ConversationModel) {
  const windowBeforeLatestUser = getConversationHistoryWindowBeforeLatestUserMessages();
  const contextTokenBudget = getConversationHistoryContextTokenBudget();
  const latestUserIndex = findLatestUserMessageIndex(history);

  if (latestUserIndex === -1) {
    const recentHistory = history.slice(-windowBeforeLatestUser);
    const scopedMessages: ChatMessage[] = [];
    let totalTokens = 0;

    for (let index = recentHistory.length - 1; index >= 0; index -= 1) {
      const nextMessage = toContextMessage(recentHistory[index], currentModel);
      const nextTokens = estimateMessageTokens(nextMessage);

      if (scopedMessages.length > 0 && totalTokens + nextTokens > contextTokenBudget) {
        continue;
      }

      scopedMessages.unshift(nextMessage);
      totalTokens += nextTokens;
    }

    return {
      messages: scopedMessages,
      trimmedMessageCount: Math.max(0, history.length - scopedMessages.length),
    };
  }

  const recentRoundHistory = history.slice(latestUserIndex);
  const earlierCandidates = history.slice(0, latestUserIndex).slice(-windowBeforeLatestUser);
  const recentRoundMessages = recentRoundHistory.map((message) => toContextMessage(message, currentModel));
  const preservedRecentRoundTokens = recentRoundMessages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  );
  const earlierMessages: ChatMessage[] = [];
  let earlierTokens = 0;

  for (let index = earlierCandidates.length - 1; index >= 0; index -= 1) {
    const nextMessage = toContextMessage(earlierCandidates[index], currentModel);
    const nextTokens = estimateMessageTokens(nextMessage);

    if (earlierMessages.length > 0 && preservedRecentRoundTokens + earlierTokens + nextTokens > contextTokenBudget) {
      continue;
    }

    earlierMessages.unshift(nextMessage);
    earlierTokens += nextTokens;
  }

  const scopedMessages = [...earlierMessages, ...recentRoundMessages];

  return {
    messages: scopedMessages,
    trimmedMessageCount: Math.max(0, history.length - scopedMessages.length),
  };
}

export function buildConversationMessagesForModel(
  history: ConversationHistoryMessage[],
  models: ConversationModel[],
  currentModel: ConversationModel,
): ChatMessage[] {
  const shortInputInstruction = buildShortInputStabilityInstruction(history);
  const scopedContext = buildScopedContextMessages(history, currentModel);

  return [
    buildReplyLengthInstruction(currentModel.config),
    buildParticipantRosterInstruction(models, currentModel),
    ...(shortInputInstruction ? [shortInputInstruction] : []),
    ...(scopedContext.trimmedMessageCount > 0 ? [buildContextWindowInstruction(scopedContext.trimmedMessageCount)] : []),
    ...scopedContext.messages,
    buildParticipationInstruction(currentModel.config),
  ];
}

export async function runSequentialConversation(
  input: SequentialConversationInput,
): Promise<SequentialConversationResult> {
  const models = [...input.models].sort((left, right) => left.sortOrder - right.sortOrder);
  const history = [...input.history];
  const persistedMessages: PersistedMessage[] = [];
  const roundOutcomes: SequentialConversationModelOutcome[] = [];
  const roundStartedAt = Date.now();

  for (const model of models) {
    const replyStartedAt = Date.now();
    let reply: Awaited<ReturnType<ModelAdapter["generateReply"]>>;

    try {
      await input.onModelStart?.({
        roomId: input.roomId,
        modelId: model.modelId,
        sortOrder: model.sortOrder,
      });

      const adapter = input.createAdapter(model.config);
      reply = await adapter.generateReply({
        config: model.config,
        messages: buildConversationMessagesForModel(history, models, model),
      });
    } catch (error) {
      const providerErrorKind = extractProviderErrorKind(error);
      const providerErrorDetails = extractProviderErrorDetails(error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await input.onModelFailed?.({
        roomId: input.roomId,
        modelId: model.modelId,
        sortOrder: model.sortOrder,
        error: errorMessage,
        providerErrorKind,
        providerErrorDetails,
      });

      roundOutcomes.push({
        modelId: model.modelId,
        outcome: "failed",
        error: errorMessage,
        providerErrorKind,
        providerErrorDetails,
      });
      continue;
    }

    const savedMessage = await input.saveAssistantMessage({
      roomId: input.roomId,
      modelId: model.modelId,
      content: reply.content,
      replyDurationMs: Date.now() - replyStartedAt,
      replyTiming: {
        ...(reply.replyTiming ?? {}),
        queueDurationMs: Math.max(0, replyStartedAt - roundStartedAt),
      },
    });

    persistedMessages.push(savedMessage);
    await input.onModelReplied?.({
      roomId: input.roomId,
      modelId: model.modelId,
      sortOrder: model.sortOrder,
      message: savedMessage,
    });
    roundOutcomes.push({
      modelId: model.modelId,
      outcome: "replied",
    });
    history.push({
      role: "assistant",
      content: savedMessage.content,
      modelId: savedMessage.modelId,
      sequence: savedMessage.sequence,
      replyDurationMs: savedMessage.replyDurationMs,
      speakerName: model.config.name,
      speakerProvider: model.config.provider,
      speakerModelName: model.config.modelName,
    });
  }

  const hasFailures = roundOutcomes.some((outcome) => outcome.outcome === "failed");

  return {
    status: hasFailures ? "partial" : "completed",
    messages: persistedMessages,
    roundOutcomes,
  };
}
