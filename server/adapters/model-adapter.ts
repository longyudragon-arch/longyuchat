import type { ChatMessage, ModelRuntimeConfig } from "@/types/chat";

export interface ModelReply {
  content: string;
  raw?: unknown;
}

export interface GenerateReplyInput {
  config: ModelRuntimeConfig;
  messages: ChatMessage[];
}

export interface ModelAdapter {
  testConnection(config: ModelRuntimeConfig): Promise<void>;
  generateReply(input: GenerateReplyInput): Promise<ModelReply>;
}

