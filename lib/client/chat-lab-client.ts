import { areDevMocksEnabledForClient } from "@/lib/runtime";
import type {
  AuthSessionView,
  DiscoveredModelView,
  JsonErrorResponse,
  MessageRole,
  ModelView,
  ProviderType,
  RoomView,
  SendRoomMessageResult,
} from "@/types/app";

export const providerOptions = [
  "OPENAI_COMPATIBLE",
  "CLAUDE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
  "HUNYUAN",
  "QWEN",
] as const;

interface ProviderPreset {
  label: string;
  labelZh: string;
  shortName: string;
  baseUrl: string;
  defaultModelName: string;
  defaultReplyLength: number;
  badgeClassName: string;
  iconClassName: string;
  softClassName: string;
}

export interface ClientErrorFeedback {
  title: string;
  description: string;
  suggestion: string;
  tone: "error" | "warning";
}

export class ClientRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const providerPresets: Record<ProviderType, ProviderPreset> = {
  OPENAI_COMPATIBLE: {
    label: "OpenAI Compatible",
    labelZh: "OpenAI 兼容",
    shortName: "OA",
    baseUrl: "https://api.openai.com/v1",
    defaultModelName: "gpt-4.1-mini",
    defaultReplyLength: 300,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "bg-emerald-500 text-white",
    softClassName: "bg-emerald-50/70",
  },
  CLAUDE: {
    label: "Claude",
    labelZh: "Claude",
    shortName: "CL",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModelName: "",
    defaultReplyLength: 300,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName: "bg-amber-500 text-white",
    softClassName: "bg-amber-50/70",
  },
  GEMINI: {
    label: "Gemini",
    labelZh: "谷歌 Gemini",
    shortName: "GM",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModelName: "gemini-2.5-flash",
    defaultReplyLength: 300,
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    iconClassName: "bg-sky-500 text-white",
    softClassName: "bg-sky-50/70",
  },
  GROK: {
    label: "Grok",
    labelZh: "xAI / Grok",
    shortName: "GK",
    baseUrl: "https://api.x.ai/v1",
    defaultModelName: "",
    defaultReplyLength: 300,
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    iconClassName: "bg-violet-500 text-white",
    softClassName: "bg-violet-50/70",
  },
  DOUBAO: {
    label: "Doubao",
    labelZh: "火山引擎 / 豆包",
    shortName: "DB",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModelName: "",
    defaultReplyLength: 300,
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    iconClassName: "bg-orange-500 text-white",
    softClassName: "bg-orange-50/70",
  },
  DEEPSEEK: {
    label: "DeepSeek",
    labelZh: "DeepSeek",
    shortName: "DS",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModelName: "deepseek-chat",
    defaultReplyLength: 300,
    badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-700",
    iconClassName: "bg-cyan-500 text-white",
    softClassName: "bg-cyan-50/70",
  },
  MODELSCOPE: {
    label: "ModelScope",
    labelZh: "魔搭社区 / ModelScope",
    shortName: "MS",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    defaultModelName: "",
    defaultReplyLength: 300,
    badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    iconClassName: "bg-fuchsia-500 text-white",
    softClassName: "bg-fuchsia-50/70",
  },
  HUNYUAN: {
    label: "Hunyuan",
    labelZh: "腾讯混元 / Hunyuan",
    shortName: "HY",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModelName: "hunyuan-turbo",
    defaultReplyLength: 300,
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    iconClassName: "bg-rose-500 text-white",
    softClassName: "bg-rose-50/70",
  },
  QWEN: {
    label: "Qwen",
    labelZh: "通义千问 / Qwen",
    shortName: "QW",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModelName: "qwen-plus",
    defaultReplyLength: 300,
    badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    iconClassName: "bg-indigo-500 text-white",
    softClassName: "bg-indigo-50/70",
  },
};

const autoDiscoverableProviders = new Set<ProviderType>([
  "OPENAI_COMPATIBLE",
  "GEMINI",
  "GROK",
  "DOUBAO",
  "DEEPSEEK",
  "MODELSCOPE",
]);

export const localMockDefinitions = [
  { name: "Mock Alpha", modelName: "mock-alpha" },
  { name: "Mock Beta", modelName: "mock-beta" },
  { name: "Mock Gamma", modelName: "mock-gamma" },
] as const;

export function supportsLocalMockTools() {
  return areDevMocksEnabledForClient();
}

export async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const data = (await response.json()) as T | JsonErrorResponse;

  if (!response.ok) {
    throw new ClientRequestError(
      (data as JsonErrorResponse).error ?? "Request failed.",
      response.status,
      (data as JsonErrorResponse).details,
    );
  }

  return data as T;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getProviderPreset(provider: ProviderType) {
  return providerPresets[provider];
}

export function getProviderLabel(provider: ProviderType) {
  return getProviderPreset(provider).label;
}

export function getProviderOptionLabel(provider: ProviderType) {
  const preset = getProviderPreset(provider);
  return `${preset.labelZh} / ${preset.label}`;
}

export function getProviderBadgeClassName(provider: ProviderType) {
  return getProviderPreset(provider).badgeClassName;
}

export function getProviderIconClassName(provider: ProviderType) {
  return getProviderPreset(provider).iconClassName;
}

export function getProviderSoftClassName(provider: ProviderType) {
  return getProviderPreset(provider).softClassName;
}

export function getProviderShortName(provider: ProviderType) {
  return getProviderPreset(provider).shortName;
}

export function supportsAutomaticModelDiscovery(provider: ProviderType) {
  return autoDiscoverableProviders.has(provider);
}

export function formatReplyLength(value: number) {
  return `最多 ${value} 字`;
}

export function toRoomLabel(type: RoomView["type"]) {
  return type === "SINGLE" ? "单聊" : "群聊";
}

export function toRoleLabel(role: MessageRole) {
  if (role === "USER") {
    return "用户";
  }

  if (role === "SYSTEM") {
    return "系统";
  }

  return "AI";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

export function describeClientError(error: unknown): ClientErrorFeedback {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();
  const status = error instanceof ClientRequestError ? error.status : undefined;

  if (status === 401 && normalized.includes("login")) {
    return {
      title: "需要先登录",
      description: message,
      suggestion: "请重新进入登录页完成登录，再继续访问模型、房间或聊天接口。",
      tone: "warning",
    };
  }

  if (status === 404 || normalized.includes("not found")) {
    return {
      title: "目标内容不存在",
      description: message,
      suggestion: "它可能已经被删除。回到上一页刷新数据，或重新创建一个新的房间/模型。",
      tone: "error",
    };
  }

  if (normalized.includes("disabled")) {
    return {
      title: "房间里存在已停用的模型",
      description: message,
      suggestion: "请先在模型管理里启用对应模型，或者把它从房间成员里移除后再继续发送消息。",
      tone: "warning",
    };
  }

  if (normalized.includes("discover") && normalized.includes("not available yet")) {
    return {
      title: "当前 Provider 还不能自动拉取模型列表",
      description: message,
      suggestion: "先手动填写模型 ID 即可，后续再补该平台原生的模型发现接口。",
      tone: "warning",
    };
  }

  if (normalized.includes("quota") || normalized.includes("billing") || normalized.includes("429")) {
    return {
      title: "当前账号额度不足或配额已超限",
      description: message,
      suggestion: "检查该平台的 billing、quota 和模型可用性；如果是预览模型，确认它是否仅支持付费层。",
      tone: "error",
    };
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network")
  ) {
    return {
      title: "模型请求超时或网络连接失败",
      description: message,
      suggestion: "优先检查 Base URL、当前网络、服务器对上游接口的连通性，以及模型服务是否可用。",
      tone: "error",
    };
  }

  if (
    normalized.includes("invalid_api_key") ||
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("401")
  ) {
    return {
      title: "API Key 无效或鉴权失败",
      description: message,
      suggestion: "请检查 API Key、Base URL 和模型 ID 是否匹配当前 Provider。",
      tone: "error",
    };
  }

  if (normalized.includes("json")) {
    return {
      title: "请求格式不正确",
      description: message,
      suggestion: "刷新页面后重试；如果仍然失败，说明当前接口参数或返回格式还需要排查。",
      tone: "error",
    };
  }

  return {
    title: "操作没有完成",
    description: message,
    suggestion: "可以先重试一次；如果仍然失败，再检查房间状态、模型配置和当前网络。",
    tone: "error",
  };
}

export function describePartialSendResult(
  result: SendRoomMessageResult,
  failedModelName: string,
): ClientErrorFeedback | null {
  if (result.status !== "partial") {
    return null;
  }

  const derivedFeedback = describeClientError(new Error(result.error ?? "本轮顺序回复在中途停止。"));

  return {
    title: `${failedModelName} 未完成本轮回复`,
    description: result.error ?? "本轮顺序回复在中途停止，前面已经成功生成的回复仍然会保留。",
    suggestion: derivedFeedback.suggestion,
    tone: "warning",
  };
}

export function getLocalMockBaseUrl() {
  if (!supportsLocalMockTools()) {
    throw new Error("Local mock tools are disabled in this environment.");
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:3000/api/dev/mock-openai";
  }

  return `${window.location.origin}/api/dev/mock-openai`;
}

export async function ensureLocalMockModels() {
  if (!supportsLocalMockTools()) {
    throw new Error("Local mock tools are disabled in this environment.");
  }

  const baseUrl = getLocalMockBaseUrl();

  await Promise.allSettled(
    localMockDefinitions.map(async (definition) => {
      await fetchJson("/api/models", {
        method: "POST",
        body: JSON.stringify({
          name: definition.name,
          provider: "OPENAI_COMPATIBLE",
          baseUrl,
          modelName: definition.modelName,
          apiKey: "local-test-key",
          defaultReplyLength: 180,
          enabled: true,
        }),
      });
    }),
  );

  const data = await fetchJson<{ models: ModelView[] }>("/api/models");
  const mockModels = localMockDefinitions
    .map((definition) => data.models.find((model) => model.name === definition.name))
    .filter((model): model is ModelView => Boolean(model));

  if (mockModels.length !== localMockDefinitions.length) {
    throw new Error("Local mock models were not created completely. Please try again.");
  }

  return mockModels;
}

export async function bootstrapLocalTestWorkspace() {
  if (!supportsLocalMockTools()) {
    throw new Error("Local mock tools are disabled in this environment.");
  }

  const mockModels = await ensureLocalMockModels();
  const roomTitle = `本地测试群聊 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date())}`;

  const data = await fetchJson<{ room: RoomView }>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      title: roomTitle,
      type: "GROUP",
      modelIds: mockModels.map((model) => model.id),
    }),
  });

  return data.room;
}

export function reorderIds(ids: string[], draggedId: string, targetId: string) {
  if (draggedId === targetId) {
    return ids;
  }

  const nextIds = [...ids];
  const sourceIndex = nextIds.indexOf(draggedId);
  const targetIndex = nextIds.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return ids;
  }

  const [movedId] = nextIds.splice(sourceIndex, 1);
  nextIds.splice(targetIndex, 0, movedId);
  return nextIds;
}

export async function sendRoomMessageRequest(roomId: string, content: string) {
  return fetchJson<SendRoomMessageResult>(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function discoverProviderModels(input: {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
}) {
  return fetchJson<{ models: DiscoveredModelView[] }>("/api/providers/discover-models", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAuthSession() {
  return fetchJson<AuthSessionView>("/api/auth/session");
}
