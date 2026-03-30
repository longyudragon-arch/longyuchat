import type { ChatMessage, ModelRuntimeConfig, ReplyTimingDetails } from "@/types/chat";

export interface ModelReply {
  content: string;
  raw?: unknown;
  replyTiming?: ReplyTimingDetails | null;
}

export interface GenerateReplyInput {
  config: ModelRuntimeConfig;
  messages: ChatMessage[];
}

export interface ModelAdapter {
  testConnection(config: ModelRuntimeConfig): Promise<void>;
  generateReply(input: GenerateReplyInput): Promise<ModelReply>;
}
