import type { ChatMessage, ModelRuntimeConfig, PersistedMessage } from "@/types/chat";
import type { ModelAdapter } from "@/server/adapters/model-adapter";

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
}

export function buildReplyLengthInstruction(config: ModelRuntimeConfig): ChatMessage {
  return {
    role: "system",
    content: `Reply in the same language as the latest user message. Your final answer must stay within ${config.defaultReplyLength} visible characters, including punctuation and spaces. If your first draft would be longer, compress and summarize it until it fits. Do not exceed the limit.`,
  };
}

export function buildParticipationInstruction(config: ModelRuntimeConfig): ChatMessage {
  return {
    role: "user",
    content: `You are ${config.name}. Continue this multi-model discussion from your own perspective. The messages above may include replies from other AI models, but you should still respond with your own answer instead of staying silent. Keep it within the required character limit.`,
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
      const reply = await adapter.generateReply({
        config: model.config,
        messages: [buildReplyLengthInstruction(model.config), ...history, buildParticipationInstruction(model.config)],
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
      };
    }
  }

  return {
    status: "completed",
    messages: persistedMessages,
  };
}
