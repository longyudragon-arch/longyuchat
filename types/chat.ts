export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  modelId?: string | null;
  sequence?: number;
}

export interface PersistedMessage extends ChatMessage {
  roomId: string;
  sequence: number;
}

export interface ModelRuntimeConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  defaultReplyLength: number;
}
