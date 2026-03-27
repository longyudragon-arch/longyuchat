export type ProviderType =
  | "OPENAI_COMPATIBLE"
  | "CLAUDE"
  | "GEMINI"
  | "GROK"
  | "DOUBAO"
  | "DEEPSEEK"
  | "MODELSCOPE"
  | "HUNYUAN"
  | "QWEN";
export type RoomType = "SINGLE" | "GROUP";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";
export type ModelTestResultStatus = "success" | "error";
export type ProviderConnectionDiscoveryStrategy =
  | "AUTO_FETCH"
  | "MANUAL_ONLY"
  | "AUTO_FETCH_WITH_MANUAL_FALLBACK";
export type ProviderConnectionCheckResultStatus = "success" | "error";
export type AccessProtectionMode = "app" | "basic" | "none";
export type ProviderConnectionTemplateCategory = "DOMESTIC" | "GLOBAL";

export interface ModelTestResultView {
  status: ModelTestResultStatus;
  message: string;
  testedAt: string;
}

export interface ModelView {
  id: string;
  name: string;
  connectionId: string | null;
  provider: ProviderType;
  baseUrl: string;
  modelName: string;
  avatarLabel: string;
  avatarColor: string;
  defaultReplyLength: number;

  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  hasApiKey: boolean;
  lastConnectionTest: ModelTestResultView | null;
}

export interface ProviderConnectionCheckView {
  status: ProviderConnectionCheckResultStatus;
  message: string;
  testedAt: string;
}

export interface ProviderConnectionView {
  id: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  discoveryStrategy: ProviderConnectionDiscoveryStrategy;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  hasApiKey: boolean;
  modelCount: number;
  supportsAutomaticModelDiscovery: boolean;
  lastAuthCheck: ProviderConnectionCheckView | null;
  lastDiscoveryCheck: ProviderConnectionCheckView | null;
}

export interface ProviderConnectionTemplateView {
  id: string;
  category: ProviderConnectionTemplateCategory;
  name: string;
  subtitle: string;
  provider: ProviderType;
  suggestedBaseUrl?: string;
  defaultModelName?: string;
  avatarLabel?: string;
  avatarColor?: string;
  preferredDiscoveryStrategy: ProviderConnectionDiscoveryStrategy;
  officialUrl: string;
  apiKeyUrl?: string;
  docsUrl?: string;
  modelsUrl?: string;
  note: string;
}

export interface ProviderCatalogView {
  templates: ProviderConnectionTemplateView[];
}

export interface CreateProviderConnectionPayload {
  name: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  discoveryStrategy?: ProviderConnectionDiscoveryStrategy;
  enabled?: boolean;
}

export interface UpdateProviderConnectionPayload {
  name?: string;
  provider?: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  discoveryStrategy?: ProviderConnectionDiscoveryStrategy;
  enabled?: boolean;
}

export interface TestProviderConnectionPayload {
  modelName?: string;
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
  model: MessageModelSnapshotView | null;
  content: string;
  createdAt: string;
}

export interface MessageModelSnapshotView {
  id: string;
  name: string;
  provider: ProviderType;
  modelName: string;
  avatarLabel: string;
  avatarColor: string;
  defaultReplyLength: number;

}

export type SendRoomMessageFailureKind =
  | "authentication"
  | "quota"
  | "not_found"
  | "network"
  | "empty_response"
  | "reasoning_only"
  | "request";

export interface ProviderErrorDetailsView {
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
}

export interface SendRoomMessageResult {
  roomId: string;
  status: "completed" | "partial";
  failedModelId?: string;
  error?: string;
  providerErrorKind?: SendRoomMessageFailureKind;
  providerErrorDetails?: ProviderErrorDetailsView;
  failedModelPaused?: boolean;
  failedModelPauseReason?: string;
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

export interface AuthSessionView {
  mode: AccessProtectionMode;
  appLoginEnabled: boolean;
  authenticated: boolean;
  username: string | null;
}
