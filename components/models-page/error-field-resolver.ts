import type { ClientErrorFeedback } from "@/lib/client/longyuchat-client";
import { getClientErrorFieldHints } from "@/lib/client/error-field-hints";

type ModelFieldScope = "submit" | "discover";

export type ModelFormFieldKey =
  | "providerTemplate"
  | "connectionId"
  | "baseUrl"
  | "apiKey"
  | "modelName";
export type ConnectionFormFieldKey = "providerTemplate" | "baseUrl" | "apiKey" | "probeModelName";

function appendFieldError<TFieldKey extends string>(
  current: Partial<Record<TFieldKey, string>>,
  key: TFieldKey,
  message: string,
) {
  if (!current[key]) {
    current[key] = message;
  }
}

function applyModelFieldHint(
  current: Partial<Record<ModelFormFieldKey, string>>,
  hint: string,
  scope: ModelFieldScope,
) {
  switch (hint) {
    case "provider":
    case "providerTemplate":
      appendFieldError(current, "providerTemplate", "请重新确认厂商模板、Provider 类型和当前接入方式是否选择正确。");
      break;
    case "connectionId":
      appendFieldError(current, "connectionId", "请先选择一个已保存连接；如果你想手动填写参数，请切回“直接配置”。");
      break;
    case "baseUrl":
      appendFieldError(current, "baseUrl", "请确认 Base URL 是否正确，并检查它是否与当前厂商模板匹配。");
      break;
    case "apiKey":
      appendFieldError(current, "apiKey", "请检查 API Key 是否正确，并确认它属于当前厂商或平台。");
      break;
    case "modelId":
    case "modelName":
      appendFieldError(
        current,
        "modelName",
        scope === "discover"
          ? "请核对模型 ID 是否存在；如果平台不返回列表，也可以直接在这里手动填写。"
          : "请核对模型 ID 是否存在，并确认它与当前接口地址和模板匹配。",
      );
      break;
    default:
      break;
  }
}

function applyConnectionFieldHint(
  current: Partial<Record<ConnectionFormFieldKey, string>>,
  hint: string,
) {
  switch (hint) {
    case "provider":
    case "providerTemplate":
      appendFieldError(current, "providerTemplate", "请重新确认厂商模板、Provider 类型和当前 Base URL 是否匹配。");
      break;
    case "discoveryStrategy":
      appendFieldError(current, "providerTemplate", "当前模板决定了测试/发现策略。请先确认是否选对了 Provider 模板。");
      break;
    case "baseUrl":
      appendFieldError(current, "baseUrl", "请确认接口地址是否正确，并检查当前网络或上游平台连通性。");
      break;
    case "apiKey":
      appendFieldError(current, "apiKey", "请检查 API Key 是否正确，并确认它属于当前厂商或平台。");
      break;
    case "modelId":
    case "modelName":
      appendFieldError(current, "probeModelName", "请填写一个可用的测试模型 ID，再重新验证连接。");
      break;
    default:
      break;
  }
}

function hasAnyFieldError<TFieldKey extends string>(value: Partial<Record<TFieldKey, string>>) {
  return Object.keys(value).length > 0;
}

function resolveModelFieldErrorsFromFeedback(
  feedback: ClientErrorFeedback,
  scope: ModelFieldScope,
): Partial<Record<ModelFormFieldKey, string>> {
  if (feedback.title.includes("API Key")) {
    return { apiKey: "请检查 API Key 是否正确，并确认它属于当前厂商或平台。" };
  }

  if (feedback.title.includes("Base URL") || feedback.title.includes("网络")) {
    return { baseUrl: "请确认接口地址是否正确，并检查当前网络或上游平台连通性。" };
  }

  if (feedback.title.includes("模型 ID") || feedback.title.includes("目标内容不存在")) {
    return { modelName: "请核对模型 ID 是否存在，或确认当前接口地址与模型匹配。" };
  }

  if (feedback.title.includes("平台未返回模型列表")) {
    return {
      modelName:
        scope === "discover"
          ? "当前平台没有返回可选模型列表，请直接在这里手动填写模型 ID。"
          : "当前平台没有返回模型列表，请确认模型 ID 是否需要手动填写。",
    };
  }

  if (feedback.title.includes("请先填入连接信息")) {
    return {
      baseUrl: "请先补全 Base URL。",
      apiKey: "请先填写 API Key，再尝试获取模型列表。",
    };
  }

  if (feedback.title.includes("请先选择一个已保存连接")) {
    return {
      connectionId: "请先从已保存连接列表里选中一条连接，或切回“直接配置”。",
    };
  }

  if (feedback.title.includes("当前模型由已保存连接托管")) {
    return {
      connectionId: "当前模型正在使用已保存连接。若要改直连参数，请先切回“直接配置”或更换连接。",
    };
  }

  if (feedback.title.includes("当前 Provider 模板暂未接入")) {
    return {
      providerTemplate: "请确认当前模型选择的厂商模板或 Provider 模式是否正确。",
    };
  }

  return {};
}

function resolveConnectionFieldErrorsFromFeedback(
  feedback: ClientErrorFeedback,
): Partial<Record<ConnectionFormFieldKey, string>> {
  if (feedback.description.includes("requires a model ID to test the connection")) {
    return { probeModelName: "当前平台缺少默认测试模型，请手动填写一个可用模型 ID 再验证连接。" };
  }

  if (feedback.title.includes("API Key")) {
    return { apiKey: "请检查 API Key 是否正确，并确认它属于当前厂商或平台。" };
  }

  if (feedback.title.includes("Base URL") || feedback.title.includes("网络")) {
    return { baseUrl: "请确认接口地址是否正确，并检查当前网络或上游平台连通性。" };
  }

  if (feedback.title.includes("目标内容不存在")) {
    return { probeModelName: "测试用模型 ID 不可用，请换一个已开通的模型再验证。" };
  }

  if (feedback.title.includes("当前 Provider 模板暂未接入")) {
    return {
      providerTemplate: "请确认当前连接选择的厂商模板、Provider 类型和 Base URL 是否匹配。",
    };
  }

  if (feedback.title.includes("该连接配置为手动录入模式")) {
    return {
      providerTemplate: "当前模板本身不支持自动发现模型列表，请直接手动填写模型 ID。",
    };
  }

  return {};
}

export function resolveModelFieldErrors(
  error: unknown,
  feedback: ClientErrorFeedback,
  scope: ModelFieldScope,
): Partial<Record<ModelFormFieldKey, string>> {
  const resolved: Partial<Record<ModelFormFieldKey, string>> = {};

  for (const hint of getClientErrorFieldHints(error)) {
    applyModelFieldHint(resolved, hint, scope);
  }

  if (hasAnyFieldError(resolved)) {
    return resolved;
  }

  return resolveModelFieldErrorsFromFeedback(feedback, scope);
}

export function resolveConnectionFieldErrors(
  error: unknown,
  feedback: ClientErrorFeedback,
): Partial<Record<ConnectionFormFieldKey, string>> {
  const resolved: Partial<Record<ConnectionFormFieldKey, string>> = {};

  for (const hint of getClientErrorFieldHints(error)) {
    applyConnectionFieldHint(resolved, hint);
  }

  if (hasAnyFieldError(resolved)) {
    return resolved;
  }

  return resolveConnectionFieldErrorsFromFeedback(feedback);
}
