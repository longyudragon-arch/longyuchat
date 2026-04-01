export type ChatRole = "system" | "user" | "assistant";

export interface ReplyTimingDetails {
  queueDurationMs?: number | null;
  providerRequestDurationMs?: number | null;
  providerAttemptCount?: number | null;
  recoveryRequestDurationMs?: number | null;
  rewriteRequestDurationMs?: number | null;
  persistenceDurationMs?: number | null;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  modelId?: string | null;
  sequence?: number;
  replyDurationMs?: number | null;
  replyTiming?: ReplyTimingDetails | null;
}

export interface ConversationHistoryMessage {
  role: Exclude<ChatRole, "system">;
  content: string;
  modelId?: string | null;
  sequence?: number;
  replyDurationMs?: number | null;
  speakerName?: string | null;
  speakerProvider?: string | null;
  speakerModelName?: string | null;
}

export interface PersistedMessage extends ChatMessage {
  id: string;
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
