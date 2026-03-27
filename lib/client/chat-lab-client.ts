import { areDevMocksEnabledForClient } from "@/lib/runtime";
import {
  findMatchingProviderTemplate,
  getDefaultDiscoveryStrategy,
  getProviderPreset as getCatalogProviderPreset,
  getProviderTemplateById,
  providerConnectionTemplates as catalogProviderConnectionTemplates,
  providerOptions as catalogProviderOptions,
  supportsAutomaticModelDiscovery as catalogSupportsAutomaticModelDiscovery,
} from "@/lib/provider-catalog";
import type {
  AuthSessionView,
  CreateProviderConnectionPayload,
  DiscoveredModelView,
  JsonErrorResponse,
  MessageView,
  MessageRole,
  ModelTestResultView,
  ModelView,
  ProviderCatalogView,
  ProviderConnectionView,
  ProviderType,
  RoomView,
  SendRoomMessageResult,
  TestProviderConnectionPayload,
  UpdateProviderConnectionPayload,
  ProviderErrorDetailsView,
} from "@/types/app";

export {
  findMatchingProviderTemplate,
  getDefaultDiscoveryStrategy,
  getProviderTemplateById,
};

export const providerOptions = catalogProviderOptions;
export const providerConnectionTemplates = catalogProviderConnectionTemplates;

interface ReferencingRoomSummary {
  id: string;
  title: string;
  type: "SINGLE" | "GROUP";
}

interface ReferencingModelSummary {
  id: string;
  name: string;
  enabled: boolean;
}

export interface ClientErrorFeedback {
  title: string;
  description: string;
  suggestion: string;
  tone: "error" | "warning";
}

export interface ModelOperationalInsight {
  shortLabel: string;
  title: string;
  description: string;
  suggestion: string;
  tone: "error" | "warning";
}

function formatProviderResponseDetails(details: ProviderErrorDetailsView | undefined) {
  if (!details) {
    return "";
  }

  const segments: string[] = [];

  if (typeof details.attemptCount === "number") {
    segments.push(`重试次数 ${details.attemptCount}`);
  }

  if (typeof details.finishReason === "string" && details.finishReason) {
    segments.push(`finish_reason=${details.finishReason}`);
  }

  if (typeof details.completionTokens === "number") {
    segments.push(`completion_tokens=${details.completionTokens}`);
  }

  if (typeof details.reasoningTokens === "number") {
    segments.push(`reasoning_tokens=${details.reasoningTokens}`);
  }

  return segments.length > 0 ? `（${segments.join("，")}）` : "";
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
      (data as JsonErrorResponse).error ?? "请求失败。",
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
  return getCatalogProviderPreset(provider);
}

export function getProviderLabel(provider: ProviderType) {
  return getProviderPreset(provider).label;
}

export function getProviderOptionLabel(provider: ProviderType) {
  const preset = getProviderPreset(provider);
  return `${preset.labelZh} / ${preset.label}`;
}

export function getProviderChineseLabel(provider: ProviderType) {
  return getProviderPreset(provider).labelZh;
}

function inferModelIssueKind(message: string) {
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes("quota") || normalized.includes("billing") || normalized.includes("token is exhausted") || normalized.includes("insufficient_quota")) {
    return "quota" as const;
  }

  if (normalized.includes("reasoning content but no final answer")) {
    return "reasoning_only" as const;
  }

  if (normalized.includes("returned an empty response") || normalized.includes("empty final answer") || normalized.includes("unusable reply")) {
    return "empty_response" as const;
  }

  if (
    normalized.includes("invalid_api_key") ||
    normalized.includes("api_key_invalid") ||
    normalized.includes("api key not found") ||
    normalized.includes("authentication failed") ||
    normalized.includes("unauthorized")
  ) {
    return "authentication" as const;
  }

  if (normalized.includes("not found")) {
    return "not_found" as const;
  }

  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("fetch failed") || normalized.includes("network")) {
    return "network" as const;
  }

  return null;
}

export function formatModelTestMessage(state: ModelTestResultView | null) {
  if (!state) {
    return "还没有执行过连接测试。";
  }

  const normalized = state.message.trim().toLowerCase();
  const autoPaused = normalized.includes("automatically paused");
  const issueKind = inferModelIssueKind(state.message);

  if (normalized === "connection test succeeded." || normalized === "connection test succeeded") {
    return "连接测试成功。";
  }

  if (autoPaused && issueKind === "quota") {
    return "系统已因额度或 token 耗尽自动暂停该模型。";
  }

  if (autoPaused && issueKind === "reasoning_only") {
    return "系统已因模型只返回推理内容而自动暂停该模型。";
  }

  if (autoPaused && issueKind === "authentication") {
    return "系统已因鉴权失败自动暂停该模型。";
  }

  if (autoPaused && issueKind === "not_found") {
    return "系统已因模型 ID 或端点不存在自动暂停该模型。";
  }

  if (issueKind === "quota") {
    return "平台返回额度不足、账单异常或 token 已耗尽。";
  }

  if (issueKind === "reasoning_only") {
    return "模型只返回了推理内容，没有给出最终答案。";
  }

  if (issueKind === "empty_response") {
    return "模型返回为空，未提供可展示的最终答案。";
  }

  if (normalized === "connection test failed." || normalized === "connection test failed") {
    return "连接测试失败。";
  }

  return state.message;
}

export function getModelOperationalInsight(model: Pick<ModelView, "enabled" | "lastConnectionTest">): ModelOperationalInsight | null {
  const state = model.lastConnectionTest;

  if (!state) {
    return null;
  }

  const normalized = state.message.trim().toLowerCase();
  const autoPaused = normalized.includes("automatically paused");
  const issueKind = inferModelIssueKind(state.message);

  if (autoPaused && issueKind === "quota") {
    return {
      shortLabel: "Token耗尽",
      title: "模型已自动暂停：额度或 Token 耗尽",
      description: "最近一次调用时，上游平台返回了额度不足、账单异常或 token 已耗尽，系统已自动暂停该模型。",
      suggestion: "先去对应平台检查余额、配额和计费状态，确认恢复后再回到模型页重新启用。",
      tone: "warning",
    };
  }

  if (autoPaused && issueKind === "reasoning_only") {
    return {
      shortLabel: "仅推理",
      title: "模型已自动暂停：只返回推理内容",
      description: "该模型连续返回了 reasoning 内容，但没有给出可见的最终答案。超短输入（如“1”“继续”）时更容易触发。",
      suggestion: "优先改成更完整的问题，或提高该模型稳定性后再重新启用。",
      tone: "warning",
    };
  }

  if (autoPaused && issueKind === "authentication") {
    return {
      shortLabel: "鉴权异常",
      title: "模型已自动暂停：鉴权失败",
      description: "最近一次调用时，上游平台拒绝了当前 API Key 或鉴权参数，系统已自动暂停该模型。",
      suggestion: "请修正 API Key、Base URL 或 Provider 模板，再重新启用。",
      tone: "warning",
    };
  }

  if (autoPaused && issueKind === "not_found") {
    return {
      shortLabel: "模型不存在",
      title: "模型已自动暂停：上游模型不存在",
      description: "当前模型 ID 或接口端点在上游平台不可用，系统已自动暂停该模型。",
      suggestion: "请核对模型 ID、Base URL 和平台模板是否匹配，修正后再重新启用。",
      tone: "warning",
    };
  }

  if (state.status === "error" && issueKind === "quota") {
    return {
      shortLabel: "额度不足",
      title: "最近一次测试提示额度不足",
      description: "该模型最近一次测试或调用时，上游平台返回了额度不足、账单异常或 token 已耗尽。",
      suggestion: "请先检查平台配额与账单状态，避免房间里再次中途停住。",
      tone: "error",
    };
  }

  if (state.status === "error" && issueKind === "reasoning_only") {
    return {
      shortLabel: "仅推理",
      title: "最近一次测试只返回了推理内容",
      description: "该模型最近一次请求里只有 reasoning，没有可展示的最终答案。超短输入更容易触发这类问题。",
      suggestion: "建议把“1”“继续”等超短输入改成完整句子，或暂时切换到更稳定的模型。",
      tone: "error",
    };
  }

  if (state.status === "error" && issueKind === "empty_response") {
    return {
      shortLabel: "空响应",
      title: "最近一次测试未返回可用答案",
      description: "该模型最近一次请求虽然到达了上游，但 completion_tokens 为 0，没有返回可展示的最终答案。",
      suggestion: "可先重试一次；若持续出现，优先判断为上游模型稳定性或兼容性问题，而不是前端展示问题。",
      tone: "error",
    };
  }

  return !model.enabled && autoPaused
    ? {
        shortLabel: "已自动暂停",
        title: "模型已自动暂停",
        description: "系统检测到该模型最近一次调用存在明确异常，因此已自动暂停，避免继续影响房间回复。",
        suggestion: "请先处理异常原因，再手动重新启用。",
        tone: "warning",
      }
    : null;
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
  return catalogSupportsAutomaticModelDiscovery(provider);
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

  return "请求失败。";
}

function formatReferencingRooms(rooms: ReferencingRoomSummary[] | undefined) {
  if (!rooms || rooms.length === 0) {
    return "";
  }

  const labels = rooms.slice(0, 3).map((room) => `${room.type === "SINGLE" ? "单聊" : "群聊"}「${room.title}」`);
  const suffix = rooms.length > 3 ? " 等房间" : "";
  return `${labels.join("、")}${suffix}`;
}

function formatReferencingModels(models: ReferencingModelSummary[] | undefined) {
  if (!models || models.length === 0) {
    return "";
  }

  const labels = models.slice(0, 3).map((model) => `「${model.name}」`);
  const suffix = models.length > 3 ? " 等模型" : "";
  return `${labels.join("、")}${suffix}`;
}

export function describeClientError(error: unknown): ClientErrorFeedback {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();
  const status = error instanceof ClientRequestError ? error.status : undefined;
  const details =
    error instanceof ClientRequestError && typeof error.details === "object" && error.details !== null
      ? (error.details as {
          roomCount?: number;
          modelName?: string;
          rooms?: ReferencingRoomSummary[];
          modelCount?: number;
          connectionName?: string;
          models?: ReferencingModelSummary[];
        })
      : undefined;

  if (status === 401 && normalized.includes("login")) {
    return {
      title: "需要先登录",
      description: message,
      suggestion: "请先回到登录页完成登录，再继续访问模型、房间或聊天功能。",
      tone: "warning",
    };
  }

  if (normalized.includes("disabled")) {
    return {
      title: "房间里存在已停用的模型",
      description: message,
      suggestion: "请先在模型管理里重新启用对应模型，或把它们从房间成员中移除后再继续发送。",
      tone: "warning",
    };
  }

  if (
    (status === 409 && typeof details?.roomCount === "number") ||
    normalized.includes("chat room") ||
    normalized.includes("room(s)") ||
    normalized.includes("still referenced by other data")
  ) {
    const roomCount = details?.roomCount;
    const modelName = details?.modelName;
    const roomPreview = formatReferencingRooms(details?.rooms);

    return {
      title: "模型仍在房间中使用",
      description:
        roomCount && modelName && roomPreview
          ? `模型「${modelName}」仍被 ${roomCount} 个房间使用，例如：${roomPreview}，所以当前不能直接删除。`
          : roomCount && modelName
            ? `模型「${modelName}」仍被 ${roomCount} 个房间使用，所以当前不能直接删除。`
            : roomCount && roomPreview
              ? `这个模型仍被 ${roomCount} 个房间使用，例如：${roomPreview}，所以当前不能直接删除。`
          : roomCount
            ? `这个模型仍被 ${roomCount} 个房间使用，所以当前不能直接删除。`
            : "这个模型仍被现有房间引用，所以当前不能直接删除。",
      suggestion: roomPreview
        ? `请先到这些房间里移除这个模型，或删除相关房间后，再回来删除模型。`
        : "请先到相关房间里移除这个模型，或删除相关房间后，再回来删除模型。",
      tone: "warning",
    };
  }

  if (
    (status === 409 && typeof details?.modelCount === "number") ||
    normalized.includes("provider connection") ||
    normalized.includes("is still used by") && normalized.includes("model(s)")
  ) {
    const modelCount = details?.modelCount;
    const connectionName = details?.connectionName;
    const modelPreview = formatReferencingModels(details?.models);

    return {
      title: "连接下仍有模型在使用",
      description:
        modelCount && connectionName && modelPreview
          ? `连接「${connectionName}」仍关联 ${modelCount} 个模型，例如：${modelPreview}，所以当前不能直接删除。`
          : modelCount && connectionName
            ? `连接「${connectionName}」仍关联 ${modelCount} 个模型，所以当前不能直接删除。`
            : modelCount && modelPreview
              ? `这个连接仍关联 ${modelCount} 个模型，例如：${modelPreview}，所以当前不能直接删除。`
              : modelCount
                ? `这个连接仍关联 ${modelCount} 个模型，所以当前不能直接删除。`
                : "这个连接仍被已有模型使用，所以当前不能直接删除。",
      suggestion: "请先切换或删除关联模型，再回来删除这个 Provider 连接。",
      tone: "warning",
    };
  }

  if (normalized.includes("discover") && normalized.includes("not available yet")) {
    return {
      title: "当前 Provider 暂不支持自动获取模型列表",
      description: message,
      suggestion: "请手动填写模型 ID；可以在平台的文档或控制台找到可用的模型 ID 列表。",
      tone: "warning",
    };
  }

  if (normalized.includes("manual model entry only") || normalized.includes("manual_only")) {
    return {
      title: "该连接配置为手动录入模式",
      description: message,
      suggestion: "请直接在模型 ID 输入框里手动填写模型 ID。",
      tone: "warning",
    };
  }

  if (normalized.includes("returned an empty model list") || normalized.includes("empty model list")) {
    return {
      title: "平台未返回模型列表",
      description: "自动获取请求成功，但该平台未返回任何可用模型，可能不支持此功能或需要特定权限。",
      suggestion: "请直接在「模型 ID」输入框里手动填写模型 ID，然后继续创建模型。",
      tone: "warning",
    };
  }

  if (normalized.includes("reasoning content but no final answer")) {
    return {
      title: "模型只返回了推理内容",
      description: message,
      suggestion: "请优先重试一次；如果仍然出现，请检查该模型是否支持当前接口格式，或暂时切换到更稳定的模型。",
      tone: "error",
    };
  }

  if (normalized.includes("returned an empty response") || normalized.includes("empty final answer")) {
    return {
      title: "模型未返回可用答案",
      description: message,
      suggestion: "请先重试一次；如果持续出现，优先检查上游模型是否真的返回了正文内容，或暂时切换到其他模型。",
      tone: "error",
    };
  }

  if (normalized.includes("quota") || normalized.includes("billing") || normalized.includes("429") || normalized.includes("token is exhausted")) {

    return {
      title: "当前额度不足或已超出配额",
      description: message,
      suggestion: "请检查该平台的计费、额度和模型可用性。如果是预览模型，请确认是否仅支持付费层。",
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
      suggestion: "请检查 Base URL、当前网络、服务器到上游模型接口的连通性，以及模型服务本身是否可用。",
      tone: "error",
    };
  }

  if (
    normalized.includes("invalid_api_key") ||
    normalized.includes("api_key_invalid") ||
    normalized.includes("api key not found") ||
    normalized.includes("key not found") ||
    normalized.includes("invalid api key") ||
    normalized.includes("incorrect api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication failed") ||
    normalized.includes("401")
  ) {
    return {
      title: "API Key 无效或鉴权失败",
      description: message,
      suggestion: "请检查 API Key、Base URL、模型 ID 是否属于同一个 Provider，并确认账号已经开通对应的 API 能力。",
      tone: "error",
    };
  }

  if (status === 404 || normalized.includes("not found")) {
    return {
      title: "目标内容不存在",
      description: message,
      suggestion: "它可能已经被删除。请返回上一层重新刷新，或重新创建对应的模型和房间。",
      tone: "error",
    };
  }

  if (normalized.includes("json")) {
    return {
      title: "请求格式不正确",
      description: message,
      suggestion: "请刷新页面后重试。如果仍然失败，说明当前接口参数或返回格式还需要继续排查。",
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

  const errorMessage = result.error ?? "本轮顺序回复在中途停止。";
  const fallbackFeedback = describeClientError(new Error(errorMessage));

  if (result.failedModelPaused) {
    if (result.providerErrorKind === "quota") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: result.failedModelPauseReason ?? errorMessage,
        suggestion: "该模型很可能已经用完 token、额度或账单余额。请先到对应平台检查配额/充值，再回到模型页重新启用。",
        tone: "warning",
      };
    }

    if (result.providerErrorKind === "authentication") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: result.failedModelPauseReason ?? errorMessage,
        suggestion: "请先修正 API Key 或鉴权配置，再回到模型页重新启用该模型。",
        tone: "warning",
      };
    }

    if (result.providerErrorKind === "not_found") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: result.failedModelPauseReason ?? errorMessage,
        suggestion: "请检查模型 ID、Base URL 和 Provider 模板是否匹配，确认无误后再重新启用。",
        tone: "warning",
      };
    }

    if (result.providerErrorKind === "reasoning_only") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: result.failedModelPauseReason ?? errorMessage,
        suggestion: "该模型连续只返回推理内容，没有给出最终答案。像“1”“继续”这类超短输入更容易触发。建议改成更完整的问题，确认兼容后再重新启用。",
        tone: "warning",
      };
    }

    if (result.providerErrorKind === "empty_response") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: result.failedModelPauseReason ?? errorMessage,
        suggestion: "该模型连续返回空答案，系统已先暂停它。请检查平台状态、模型兼容性，确认恢复后再重新启用。",
        tone: "warning",
      };
    }

    return {
      title: `${failedModelName} 已自动暂停`,
      description: result.failedModelPauseReason ?? errorMessage,
      suggestion: "该模型当前返回异常或不稳定，系统已先暂停它，避免继续影响房间回复。请检查平台状态、模型兼容性，确认恢复后再重新启用。",
      tone: "warning",
    };
  }

  if (result.providerErrorKind === "reasoning_only") {
    return {
      title: `${failedModelName} 只返回了推理内容`,
      description: errorMessage,
      suggestion: "这种情况在“1”“继续”“嗯”等超短输入时更容易出现。请优先改成更完整的问题，或重试一次。",
      tone: "warning",
    };
  }

  if (result.providerErrorKind === "empty_response") {
    const diagnosticSuffix = formatProviderResponseDetails(result.providerErrorDetails);
    const detailDescription =
      typeof result.providerErrorDetails?.completionTokens === "number" &&
      result.providerErrorDetails.completionTokens === 0
        ? `上游接口已响应，但没有生成任何正文内容${diagnosticSuffix}。`
        : errorMessage;

    return {
      title: `${failedModelName} 未返回可用答案`,
      description: detailDescription,
      suggestion:
        "上游已响应，但没有返回最终答案。请先重试一次；若持续出现，优先判断为平台侧空响应或兼容性问题，再考虑切换模型。",
      tone: "warning",
    };
  }

  return {
    title: `${failedModelName} 未完成本轮回复`,
    description: errorMessage,
    suggestion: fallbackFeedback.suggestion,
    tone: "warning",
  };
}



export function getLocalMockBaseUrl() {
  if (!supportsLocalMockTools()) {
    throw new Error("当前环境没有启用本地 mock 工具。");
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:3000/api/dev/mock-openai";
  }

  return `${window.location.origin}/api/dev/mock-openai`;
}

export async function ensureLocalMockModels() {
  if (!supportsLocalMockTools()) {
    throw new Error("当前环境没有启用本地 mock 工具。");
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
    throw new Error("本地 mock 模型没有完整创建出来，请再试一次。");
  }

  return mockModels;
}

export async function bootstrapLocalTestWorkspace() {
  if (!supportsLocalMockTools()) {
    throw new Error("当前环境没有启用本地 mock 工具。");
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

export function findNextUserMessageAfterSequence(messages: MessageView[], baselineSequence: number) {
  return messages.find((message) => message.role === "USER" && message.sequence > baselineSequence) ?? null;
}

export function countAssistantRepliesForUserMessage(messages: MessageView[], userSequence: number) {
  const nextUserMessage = messages.find((message) => message.role === "USER" && message.sequence > userSequence);
  const nextUserSequence = nextUserMessage?.sequence ?? Number.POSITIVE_INFINITY;

  return messages.filter(
    (message) =>
      message.role === "ASSISTANT" && message.sequence > userSequence && message.sequence < nextUserSequence,
  ).length;
}

export type UserMessageRoundStatus = "sent" | "awaiting" | "in-progress" | "partial" | "completed";

export function getUserMessageRoundStatus(input: {
  message: MessageView;
  messages: MessageView[];
  expectedAssistantCount: number;
  pendingRoundUserSequence?: number | null;
  sendInProgress?: boolean;
}): UserMessageRoundStatus {
  const assistantReplyCount = countAssistantRepliesForUserMessage(input.messages, input.message.sequence);
  const isPendingRound = input.pendingRoundUserSequence === input.message.sequence;

  if (assistantReplyCount >= input.expectedAssistantCount) {
    return "completed";
  }

  if (isPendingRound && input.sendInProgress) {
    return assistantReplyCount === 0 ? "awaiting" : "in-progress";
  }

  if (assistantReplyCount > 0) {
    return "partial";
  }

  return "sent";
}

export async function sendRoomMessageRequest(roomId: string, content: string) {
  return fetchJson<SendRoomMessageResult>(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function fetchProviderConnectionsRequest() {
  return fetchJson<{ connections: ProviderConnectionView[] }>("/api/provider-connections");
}

export async function fetchProviderCatalogRequest() {
  return fetchJson<ProviderCatalogView>("/api/provider-catalog");
}

export async function fetchProviderConnectionByIdRequest(connectionId: string) {
  return fetchJson<{ connection: ProviderConnectionView }>(`/api/provider-connections/${connectionId}`);
}

export async function createProviderConnectionRequest(input: CreateProviderConnectionPayload) {
  return fetchJson<{ connection: ProviderConnectionView }>("/api/provider-connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProviderConnectionRequest(
  connectionId: string,
  input: UpdateProviderConnectionPayload,
) {
  return fetchJson<{ connection: ProviderConnectionView }>(`/api/provider-connections/${connectionId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteProviderConnectionRequest(connectionId: string) {
  return fetchJson<null>(`/api/provider-connections/${connectionId}`, {
    method: "DELETE",
  });
}

export async function testProviderConnectionRequest(
  connectionId: string,
  input?: TestProviderConnectionPayload,
) {
  return fetchJson<{ ok: true; connection: ProviderConnectionView }>(
    `/api/provider-connections/${connectionId}/test`,
    {
      method: "POST",
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}

export async function discoverProviderModelsByConnectionRequest(connectionId: string) {
  return fetchJson<{ models: DiscoveredModelView[] }>(`/api/provider-connections/${connectionId}/discover-models`, {
    method: "POST",
  });
}

export async function discoverProviderModelsBySavedModelRequest(modelId: string) {
  return fetchJson<{ models: DiscoveredModelView[] }>(`/api/models/${modelId}/discover-models`, {
    method: "POST",
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
