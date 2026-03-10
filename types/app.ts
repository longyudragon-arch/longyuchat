export type ProviderType =
  | "OPENAI_COMPATIBLE"
  | "CLAUDE"
  | "GEMINI"
  | "GROK"
  | "DOUBAO"
  | "DEEPSEEK"
  | "MODELSCOPE";
export type RoomType = "SINGLE" | "GROUP";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";
export type ModelTestResultStatus = "success" | "error";

export interface ModelTestResultView {
  status: ModelTestResultStatus;
  message: string;
  testedAt: string;
}

export interface ModelView {
  id: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  modelName: string;
  defaultReplyLength: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  hasApiKey: boolean;
  lastConnectionTest: ModelTestResultView | null;
}

export interface RoomModelView {
  id: string;
  roomId: string;
  modelId: string;
  sortOrder: number;
  model: ModelView;
}

export interface RoomLastMessagePreviewView {
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface RoomView {
  id: string;
  title: string;
  type: RoomType;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: RoomLastMessagePreviewView | null;
  roomModels: RoomModelView[];
}

export interface MessageView {
  id: string;
  roomId: string;
  sequence: number;
  role: MessageRole;
  modelId: string | null;
  content: string;
  createdAt: string;
}

export interface SendRoomMessageResult {
  roomId: string;
  status: "completed" | "partial";
  failedModelId?: string;
  error?: string;
}

export interface DiscoveredModelView {
  id: string;
  label: string;
  description: string | null;
}

export interface JsonErrorResponse {
  error?: string;
  details?: unknown;
}
