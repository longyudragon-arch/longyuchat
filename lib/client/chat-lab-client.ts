import { areDevMocksEnabledForClient } from "@/lib/runtime";
import {
  findMatchingProviderTemplate,
  getDefaultDiscoveryStrategy,
  getDirectCreateProviderOptions as getCatalogDirectCreateProviderOptions,
  getProviderCapabilities as getCatalogProviderCapabilities,
  getProviderPreset as getCatalogProviderPreset,
  getProviderTemplateById,
  providerConnectionTemplates as catalogProviderConnectionTemplates,
  providerOptions as catalogProviderOptions,
  supportsAutomaticModelDiscovery as catalogSupportsAutomaticModelDiscovery,
} from "@/lib/provider-catalog";
import type {
  ApiErrorDetailsView,
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

export function getDirectCreateProviderOptions() {
  return getCatalogDirectCreateProviderOptions();
}

export function getProviderCapabilities(provider: ProviderType) {
  return getCatalogProviderCapabilities(provider);
}

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

function extractUnsupportedProviderName(message: string) {
  const match = message.match(/provider\s+([a-z_]+)\s+is not supported in the mvp yet/i);
  return match?.[1]?.trim().toUpperCase() ?? null;
}

function getProviderProtocolLabel(provider: string | null) {
  switch (provider) {
    case "CLAUDE":
      return "Claude 原生接口";
    case "GEMINI":
      return "Gemini 原生接口";
    case "GROK":
      return "Grok 原生接口";
    case "OPENAI_COMPATIBLE":
      return "OpenAI 兼容接口";
    case "DOUBAO":
      return "豆包接口";
    case "DEEPSEEK":
      return "DeepSeek 接口";
    case "MODELSCOPE":
      return "ModelScope 接口";
    case "HUNYUAN":
      return "混元接口";
    case "QWEN":
      return "通义千问接口";
    default:
      return provider ? `${provider} 接口` : "当前 Provider 接口";
  }
}

function isTimeoutLikeMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("before the provider responded") ||
    normalized.includes("taskcanceledexception") ||
    normalized.includes("已取消一个任务")
  );
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

  if (issueKind === "network" && isTimeoutLikeMessage(state.message)) {
    return "模型请求超时。";
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

  if (state.status === "error" && issueKind === "network" && isTimeoutLikeMessage(state.message)) {
    return {
      shortLabel: "请求超时",
      title: "最近一次测试响应超时",
      description: "该模型最近一次请求在等待上游平台完成响应时超时了，通常说明平台响应过慢、当前网络不稳，或这个模型在当前接口上稳定性不足。",
      suggestion: "如果连续出现超时，建议先停用这个模型，或切换到更稳定/更快的模型后再继续加入房间。",
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

export function formatReplyDurationMs(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return null;
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  if (value < 10_000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value / 1000)}s`;
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

function getClientErrorDetails(error: unknown) {
  if (!(error instanceof ClientRequestError)) {
    return undefined;
  }

  if (!error.details || typeof error.details !== "object") {
    return undefined;
  }

  return error.details as ApiErrorDetailsView;
}

function inferProviderIssueKind(details: ApiErrorDetailsView | undefined, message: string) {
  if (typeof details?.providerErrorKind === "string") {
    return details.providerErrorKind;
  }

  if (details?.reasonCode === "provider_authentication_failed") {
    return "authentication" as const;
  }

  if (details?.reasonCode === "provider_quota_exhausted") {
    return "quota" as const;
  }

  if (details?.reasonCode === "provider_target_not_found") {
    return "not_found" as const;
  }

  if (details?.reasonCode === "provider_timeout") {
    return "network" as const;
  }

  if (details?.reasonCode === "provider_reasoning_only") {
    return "reasoning_only" as const;
  }

  if (details?.reasonCode === "provider_empty_response") {
    return "empty_response" as const;
  }

  if (details?.reasonCode === "provider_request_failed") {
    return "request" as const;
  }

  if (typeof details?.upstreamStatus === "number") {
    if (details.upstreamStatus === 401 || details.upstreamStatus === 403) {
      return "authentication" as const;
    }

    if (details.upstreamStatus === 404) {
      return "not_found" as const;
    }

    if (details.upstreamStatus === 429) {
      return "quota" as const;
    }
  }

  return inferModelIssueKind(message);
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
  const unsupportedProvider = extractUnsupportedProviderName(message);
  const details = getClientErrorDetails(error) as
    | (ApiErrorDetailsView & {
        rooms?: ReferencingRoomSummary[];
        models?: ReferencingModelSummary[];
      })
    | undefined;
  const issueKind = inferProviderIssueKind(details, message);
  const reasonCode = details?.reasonCode;

  if (status === 401 && normalized.includes("login")) {
    return {
      title: "需要先登录",
      description: message,
      suggestion: "请先回到登录页完成登录，再继续访问模型、房间或聊天功能。",
      tone: "warning",
    };
  }

  if (reasonCode === "app_login_disabled") {
    return {
      title: "当前站点未开启登录",
      description: message,
      suggestion: "这是服务器侧配置状态，不是你的输入问题。请先联系管理员确认访问保护方式。",
      tone: "warning",
    };
  }

  if (reasonCode === "app_login_misconfigured") {
    return {
      title: "登录服务配置不完整",
      description: message,
      suggestion: "当前站点的登录配置还没准备好。请先检查 APP_LOGIN_USERNAME、APP_LOGIN_PASSWORD 等环境变量。",
      tone: "warning",
    };
  }

  if (reasonCode === "invalid_credentials") {
    return {
      title: "用户名或密码不正确",
      description: message,
      suggestion: "请检查用户名和密码后再试一次。如果你确认输入无误，请联系管理员重置登录配置。",
      tone: "warning",
    };
  }

  if (reasonCode === "invalid_request_payload") {
    return {
      title: "请求参数不完整或格式不正确",
      description: message,
      suggestion: "请检查当前表单必填项是否都已填写完整；如果刷新后仍然失败，再继续排查字段映射或接口参数。",
      tone: "warning",
    };
  }

  if (reasonCode === "invalid_json_body") {
    return {
      title: "请求体格式不正确",
      description: message,
      suggestion: "这次提交的请求体不是合法 JSON。请刷新页面后重试；如果仍然出现，说明当前前端请求拼装还需要继续排查。",
      tone: "error",
    };
  }

  if (reasonCode === "room_title_required") {
    return {
      title: "房间名称不能为空",
      description: message,
      suggestion: "请先填写一个清晰的房间名称，再保存房间配置。",
      tone: "warning",
    };
  }

  if (reasonCode === "unsupported_room_type") {
    return {
      title: "房间类型不支持",
      description: message,
      suggestion: "请重新选择单聊或群聊后再提交。如果刷新后仍然出现，说明当前房间类型参数还需要继续排查。",
      tone: "error",
    };
  }

  if (reasonCode === "room_single_requires_one_model") {
    return {
      title: "单聊必须且只能选择 1 个模型",
      description: message,
      suggestion: "请只保留 1 个模型，或切换回群聊模式后再保存。",
      tone: "warning",
    };
  }

  if (reasonCode === "room_group_requires_two_models") {
    return {
      title: "群聊至少需要 2 个模型",
      description: message,
      suggestion: "请至少选择 2 个可用模型后再保存群聊配置。",
      tone: "warning",
    };
  }

  if (reasonCode === "room_duplicate_model_selection") {
    return {
      title: "同一个模型不能重复加入房间",
      description: message,
      suggestion: "请去掉重复的模型成员后再保存房间配置。",
      tone: "warning",
    };
  }

  if (reasonCode === "record_already_exists") {
    return {
      title: "记录已存在",
      description: message,
      suggestion: "这通常是重复创建了同名或同唯一约束的数据。请检查是否已经存在相同记录，再决定是编辑原有内容还是调整输入。",
      tone: "warning",
    };
  }

  if (reasonCode === "record_still_referenced") {
    return {
      title: "数据仍被其他内容引用",
      description: message,
      suggestion: "请先解除相关引用关系，再回来删除或修改这条记录。",
      tone: "warning",
    };
  }

  if (normalized.includes("cooling down") || normalized.includes("runnable models")) {
    return {
      title: "当前房间暂时没有可运行的模型",
      description: message,
      suggestion: "房间里的模型目前都在冷却中或已停用。请等待冷却结束，或先恢复至少一个健康模型后再继续发送。",
      tone: "warning",
    };
  }

  if (reasonCode === "room_message_in_flight") {
    return {
      title: "当前房间正在回复中",
      description: message,
      suggestion: "这一轮顺序回复还没结束。请稍等当前轮次完成后再发送下一条消息，避免房间上下文交叉。",
      tone: "warning",
    };
  }

  if (reasonCode === "room_has_no_runnable_models") {
    return {
      title: "当前房间暂时没有可运行的模型",
      description: message,
      suggestion: "房间里的模型目前都在冷却中或已停用。请等待冷却结束，或先恢复至少一个健康模型后再继续发送。",
      tone: "warning",
    };
  }

  if (reasonCode === "room_has_no_models") {
    return {
      title: "当前房间还没有绑定模型",
      description: message,
      suggestion: "请先回到房间配置，为这个房间绑定至少一个可用模型后再继续发送。",
      tone: "warning",
    };
  }

  if (reasonCode === "provider_connection_manual_only") {
    return {
      title: "该连接配置为手动录入模式",
      description: message,
      suggestion: "这类连接不会自动获取模型列表。请直接在模型 ID 输入框里手动填写模型 ID。",
      tone: "warning",
    };
  }

  if (reasonCode === "provider_connection_probe_model_required") {
    return {
      title: "需要提供探针模型 ID",
      description: message,
      suggestion: "当前 Provider 没有默认探针模型。请在测试连接时补一个可用的模型 ID，再执行连接验证。",
      tone: "warning",
    };
  }

  if (reasonCode === "model_linked_to_connection") {
    return {
      title: "当前模型由已保存连接托管",
      description: message,
      suggestion: "如果要改 Base URL、API Key 或 Provider 模板，请先切到“直接配置”，或者先切换到另一个已保存连接。",
      tone: "warning",
    };
  }

  if (reasonCode === "model_direct_config_incomplete") {
    return {
      title: "直连模式所需字段还没填完整",
      description: message,
      suggestion: "请补齐 Provider、Base URL 和 API Key；如果你本来想走连接模式，可以切回“使用已保存连接”。",
      tone: "warning",
    };
  }

  if (issueKind === "reasoning_only") {
    return {
      title: "模型只返回了推理内容",
      description: message,
      suggestion: "请优先重试一次；如果仍然出现，请检查该模型是否支持当前接口格式，或暂时切换到更稳定的模型。",
      tone: "error",
    };
  }

  if (issueKind === "empty_response") {
    return {
      title: "模型未返回可用答案",
      description: message,
      suggestion: "请先重试一次；如果持续出现，优先检查上游模型是否真的返回了正文内容，或暂时切换到其他模型。",
      tone: "error",
    };
  }

  if (issueKind === "quota") {
    return {
      title: "当前额度不足或已超出配额",
      description: message,
      suggestion: "请检查该平台的计费、额度和模型可用性。如果是预览模型，请确认是否仅支持付费层。",
      tone: "error",
    };
  }

  if (issueKind === "network") {
    return {
      title: isTimeoutLikeMessage(message) ? "模型请求超时" : "模型请求超时或网络连接失败",
      description: message,
      suggestion: isTimeoutLikeMessage(message)
        ? "这通常说明上游模型响应过慢，或当前网络到模型接口的链路不稳定。请先重试一次；如果连续超时，建议先停用这个模型，或切换到更快、更稳定的模型。"
        : "请检查 Base URL、当前网络、服务器到上游模型接口的连通性，以及模型服务本身是否可用。",
      tone: "error",
    };
  }

  if (issueKind === "authentication") {
    return {
      title: "API Key 无效或鉴权失败",
      description: message,
      suggestion: "请检查 API Key、Base URL、模型 ID 是否属于同一个 Provider，并确认账号已经开通对应的 API 能力。",
      tone: "error",
    };
  }

  if (issueKind === "not_found") {
    return {
      title: "模型 ID、端点或上游资源不存在",
      description: message,
      suggestion: "请检查模型 ID、Base URL、Provider 模板和当前接口路径是否匹配；如果这是平台限制，也可以先切回手动模型 ID 或更换模型。",
      tone: "error",
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

  if (normalized.includes("is not supported in the mvp yet")) {
    const providerLabel = getProviderProtocolLabel(unsupportedProvider);

    return {
      title: "当前 Provider 模板暂未接入",
      description: `系统检测到当前模型配置走的是 ${providerLabel}，但当前 MVP 还没有接入这条原生调用链。`,
      suggestion:
        "如果这本来应该是谷歌、OpenAI 兼容或其他已支持模型，请回到模型页检查 Provider 模板和 Base URL 是否选错；如果你确实要用这条原生接口，需要等后端适配接入后再启用。",
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

  if (status === 404 || normalized.includes("not found")) {
    if (reasonCode === "provider_connection_not_found") {
      return {
        title: "Provider 连接不存在",
        description: message,
        suggestion: "这个连接可能已经被删除。请刷新连接列表后重新选择，或重新创建一条新的连接。",
        tone: "error",
      };
    }

    if (reasonCode === "model_not_found") {
      return {
        title: "模型不存在",
        description: message,
        suggestion: "这个模型可能已经被删除。请刷新模型列表后重新选择，或重新创建模型。",
        tone: "error",
      };
    }

    if (reasonCode === "room_not_found") {
      return {
        title: "房间不存在",
        description: message,
        suggestion: "这个房间可能已经被删除或地址已失效。请回到房间列表刷新后重试。",
        tone: "error",
      };
    }

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

function formatRoundOutcomeModelNames(
  outcomes: Array<Pick<SendRoomMessageResult["roundOutcomes"][number], "modelName">>,
) {
  return `${outcomes.slice(0, 3).map((outcome) => outcome.modelName).join("、")}${outcomes.length > 3 ? " 等模型" : ""}`;
}

export function describePartialSendResult(result: SendRoomMessageResult): ClientErrorFeedback | null {
  if (result.status !== "partial") {
    return null;
  }

  const failedOutcomes = result.roundOutcomes.filter((outcome) => outcome.outcome === "failed");
  const successfulCount = result.roundOutcomes.filter((outcome) => outcome.outcome === "replied").length;

  if (failedOutcomes.length === 0) {
    return {
      title: "本轮顺序回复没有完整成功",
      description: "这一轮里有模型未能成功完成回复，但没有返回完整的失败详情。",
      suggestion: "请先重试一次；如果持续出现，建议查看右侧模型执行链和最近失败信息。",
      tone: "warning",
    };
  }

  if (failedOutcomes.length > 1) {
    const pausedCount = failedOutcomes.filter((outcome) => outcome.paused).length;
    const coolingCount = failedOutcomes.filter((outcome) => outcome.cooldownUntil).length;
    const failedModelLabel = formatRoundOutcomeModelNames(failedOutcomes);

    return {
      title: `本轮已降级完成，${failedOutcomes.length} 个模型失败`,
      description:
        successfulCount > 0
          ? `这一轮里，${successfulCount} 个健康模型已继续完成回复；失败的模型有 ${failedModelLabel}。`
          : `这一轮里没有模型成功回复；失败的模型有 ${failedModelLabel}。`,
      suggestion:
        pausedCount > 0
          ? `其中 ${pausedCount} 个模型已被自动暂停${coolingCount > 0 ? `，另有 ${coolingCount} 个模型已进入冷却` : ""}。建议优先检查这些模型的鉴权、额度和接口可用性，再决定是否重新启用。`
          : coolingCount > 0
            ? `失败模型已进入冷却，后续轮次会先跳过它们，剩余健康模型会继续降级运行。建议先观察右侧执行链，再决定是否停用或替换。`
            : "建议优先查看右侧执行链中的最近失败信息，再决定是否停用或替换这些模型。",
      tone: "warning",
    };
  }

  const failedOutcome = failedOutcomes[0];
  const failedModelName = failedOutcome.modelName;
  const errorMessage = failedOutcome.error ?? "本轮顺序回复在中途停止。";
  const fallbackFeedback = describeClientError(new Error(errorMessage));
  const continuedReplySuffix = successfulCount > 0 ? " 其他健康模型已经继续完成本轮回复。" : "";
  const unsupportedProvider = extractUnsupportedProviderName(errorMessage);

  if (unsupportedProvider || errorMessage.toLowerCase().includes("is not supported in the mvp yet")) {
    const providerLabel = getProviderProtocolLabel(unsupportedProvider);

    return {
      title: `${failedModelName} 当前配置暂未接入`,
      description: `系统检测到这个模型本轮走的是 ${providerLabel}，而当前 MVP 还没有接入这条原生调用链。${continuedReplySuffix}`,
      suggestion:
        "如果它本来应该是谷歌、OpenAI 兼容或其他已支持模型，请回到模型页检查 Provider 模板和 Base URL 是否选错；如果你确实要用这条原生接口，需要等对应适配接入后再启用。",
      tone: "warning",
    };
  }

  if (failedOutcome.paused) {
    if (failedOutcome.providerErrorKind === "quota") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: `${failedOutcome.pauseReason ?? errorMessage}${continuedReplySuffix}`,
        suggestion:
          "该模型很可能已经用完 token、额度或账单余额。请先到对应平台检查配额/充值，再回到模型页重新启用。",
        tone: "warning",
      };
    }

    if (failedOutcome.providerErrorKind === "authentication") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: `${failedOutcome.pauseReason ?? errorMessage}${continuedReplySuffix}`,
        suggestion: "请先修正 API Key 或鉴权配置，再回到模型页重新启用该模型。",
        tone: "warning",
      };
    }

    if (failedOutcome.providerErrorKind === "not_found") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: `${failedOutcome.pauseReason ?? errorMessage}${continuedReplySuffix}`,
        suggestion: "请检查模型 ID、Base URL 和 Provider 模板是否匹配，确认无误后再重新启用。",
        tone: "warning",
      };
    }

    if (failedOutcome.providerErrorKind === "reasoning_only") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: `${failedOutcome.pauseReason ?? errorMessage}${continuedReplySuffix}`,
        suggestion: "该模型连续只返回推理内容，没有给出最终答案。像“1”“继续”这类超短输入更容易触发。建议改成更完整的问题，确认兼容后再重新启用。",
        tone: "warning",
      };
    }

    if (failedOutcome.providerErrorKind === "empty_response") {
      return {
        title: `${failedModelName} 已自动暂停`,
        description: `${failedOutcome.pauseReason ?? errorMessage}${continuedReplySuffix}`,
        suggestion: "该模型连续返回空答案，系统已先暂停它。请检查平台状态、模型兼容性，确认恢复后再重新启用。",
        tone: "warning",
      };
    }

    return {
      title: `${failedModelName} 已自动暂停`,
      description: `${failedOutcome.pauseReason ?? errorMessage}${continuedReplySuffix}`,
      suggestion: "该模型当前返回异常或不稳定，系统已先暂停它，避免继续影响房间回复。请检查平台状态、模型兼容性，确认恢复后再重新启用。",
      tone: "warning",
    };
  }

  if (failedOutcome.providerErrorKind === "reasoning_only") {
    return {
      title: `${failedModelName} 只返回了推理内容`,
      description: `${errorMessage}${continuedReplySuffix}`,
      suggestion: "这种情况在“1”“继续”“嗯”等超短输入时更容易出现。请优先改成更完整的问题，或重试一次。",
      tone: "warning",
    };
  }

  if (failedOutcome.providerErrorKind === "empty_response") {
    const diagnosticSuffix = formatProviderResponseDetails(failedOutcome.providerErrorDetails);
    const detailDescription =
      typeof failedOutcome.providerErrorDetails?.completionTokens === "number" &&
      failedOutcome.providerErrorDetails.completionTokens === 0
        ? `上游接口已响应，但没有生成任何正文内容${diagnosticSuffix}。${continuedReplySuffix}`
        : `${errorMessage}${continuedReplySuffix}`;

    return {
      title: `${failedModelName} 未返回可用答案`,
      description: detailDescription,
      suggestion:
        "上游已响应，但没有返回最终答案。请先重试一次；若持续出现，优先判断为平台侧空响应或兼容性问题，再考虑切换模型。",
      tone: "warning",
    };
  }

  if (failedOutcome.providerErrorKind === "network" && isTimeoutLikeMessage(errorMessage)) {
    const cooldownSuffix = failedOutcome.cooldownUntil
      ? ` 系统已先把它冷却到 ${formatDate(failedOutcome.cooldownUntil)}，后续轮次会暂时跳过它。`
      : "";

    return {
      title: `${failedModelName} 本轮请求超时`,
      description: `${errorMessage}${continuedReplySuffix}`,
      suggestion: `该模型在本轮等待上游响应时超时了。可以先重试一次；如果连续出现，建议在模型页先停用它，或换成更快、更稳定的模型。${cooldownSuffix}`,
      tone: "warning",
    };
  }

  return {
    title: `${failedModelName} 未完成本轮回复`,
    description: `${errorMessage}${continuedReplySuffix}`,
    suggestion: fallbackFeedback.suggestion,
    tone: "warning",
  };
}

function formatSkippedModelsLabel(result: SendRoomMessageResult) {
  if (!result.skippedModels || result.skippedModels.length === 0) {
    return null;
  }

  const labels = result.skippedModels.slice(0, 3).map((model) => {
    if (model.reason === "cooldown") {
      return model.availableAt ? `${model.name}（冷却至 ${formatDate(model.availableAt)}）` : `${model.name}（冷却中）`;
    }

    return `${model.name}（已停用）`;
  });

  return `${labels.join("、")}${result.skippedModels.length > 3 ? " 等模型" : ""}`;
}

export function describeSkippedModelsResult(result: SendRoomMessageResult): ClientErrorFeedback | null {
  if (!result.skippedModels || result.skippedModels.length === 0) {
    return null;
  }

  const skippedLabel = formatSkippedModelsLabel(result);
  const cooldownCount = result.skippedModels.filter((model) => model.reason === "cooldown").length;
  const disabledCount = result.skippedModels.length - cooldownCount;

  return {
    title: cooldownCount > 0 ? "本轮已跳过冷却中的模型" : "本轮已跳过不可用模型",
    description: skippedLabel
      ? `为了让健康模型继续回复，这一轮暂时跳过了 ${skippedLabel}。`
      : "为了让健康模型继续回复，这一轮暂时跳过了部分不可用模型。",
    suggestion:
      cooldownCount > 0
        ? `当前有 ${cooldownCount} 个模型处于冷却中${disabledCount > 0 ? `，另有 ${disabledCount} 个模型已停用` : ""}。它们恢复前，房间会继续以剩余健康模型降级运行。`
        : "当前有模型已停用。你可以去模型页重新启用，或继续让剩余健康模型参与当前房间。",
    tone: "warning",
  };
}

export function describeInterruptedSendRecovery(input: {
  expectedAssistantCount: number;
  assistantReplyCount: number;
}): ClientErrorFeedback {
  const expectedAssistantCount = Math.max(0, input.expectedAssistantCount);
  const assistantReplyCount = Math.max(0, input.assistantReplyCount);

  if (expectedAssistantCount > 0 && assistantReplyCount >= expectedAssistantCount) {
    return {
      title: "本轮连接中断，但服务器已完成回复",
      description: "浏览器没有收到这次发送的最终响应，但服务器已经完成当前轮顺序回复，最新消息已同步到房间。",
      suggestion: "不用重复发送同一条消息；如果这类情况频繁出现，请继续排查浏览器网络、反向代理超时或服务器到上游模型的链路稳定性。",
      tone: "warning",
    };
  }

  if (assistantReplyCount > 0) {
    return {
      title: "本轮连接中断，但服务器已继续执行",
      description:
        expectedAssistantCount > 0
          ? `浏览器没有收到这次发送的最终响应，但服务器已经接收这条消息，并同步了 ${assistantReplyCount}/${expectedAssistantCount} 个模型回复。后续模型可能仍在继续执行。`
          : "浏览器没有收到这次发送的最终响应，但服务器已经接收这条消息，并同步了部分模型回复。",
      suggestion: "先不要重复发送同一条消息；请稍等片刻观察房间状态，必要时刷新页面确认后续模型的回复是否已经同步。",
      tone: "warning",
    };
  }

  return {
    title: "消息已提交，服务器可能仍在继续执行",
    description: "浏览器没有收到这次发送的最终响应，但这条用户消息已经保存到房间。服务器可能仍在继续顺序调用后续模型。",
    suggestion: "请先不要立即重发同一条消息，以免产生重复上下文；可以稍等几秒或刷新房间，确认服务器是否已经继续执行。",
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

export function listAssistantRepliesForUserMessage(messages: MessageView[], userSequence: number) {
  const nextUserMessage = messages.find((message) => message.role === "USER" && message.sequence > userSequence);
  const nextUserSequence = nextUserMessage?.sequence ?? Number.POSITIVE_INFINITY;

  return messages.filter(
    (message) =>
      message.role === "ASSISTANT" && message.sequence > userSequence && message.sequence < nextUserSequence,
  );
}

export function countAssistantRepliesForUserMessage(messages: MessageView[], userSequence: number) {
  return listAssistantRepliesForUserMessage(messages, userSequence).length;
}

export function listAssistantReplyModelIdsForUserMessage(messages: MessageView[], userSequence: number) {
  return [...new Set(listAssistantRepliesForUserMessage(messages, userSequence).map((message) => message.modelId).filter((modelId): modelId is string => Boolean(modelId)))];
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
