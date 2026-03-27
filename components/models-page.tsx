"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  createProviderConnectionRequest,
  deleteProviderConnectionRequest,
  describeClientError,
  discoverProviderModels,
  discoverProviderModelsByConnectionRequest,
  discoverProviderModelsBySavedModelRequest,
  ensureLocalMockModels,
  fetchJson,
  fetchProviderCatalogRequest,
  fetchProviderConnectionsRequest,
  formatDate,
  formatModelTestMessage,
  formatReplyLength,
  getModelOperationalInsight,
  getProviderBadgeClassName,
  getProviderChineseLabel,
  getProviderOptionLabel,
  getProviderPreset,
  getLocalMockBaseUrl,
  providerConnectionTemplates,
  providerOptions,
  supportsAutomaticModelDiscovery,
  supportsLocalMockTools,
  testProviderConnectionRequest,
  updateProviderConnectionRequest,
  type ClientErrorFeedback,
  type ModelOperationalInsight,
} from "@/lib/client/chat-lab-client";
import {
  getModelAvatarPalette,
  getProviderDefaultAvatarColor,
  getProviderDefaultAvatarLabel,
  normalizeModelAvatarLabel,
  resolveModelAvatar,
} from "@/lib/model-avatar";


import type {
  CreateProviderConnectionPayload,
  DiscoveredModelView,
  ModelTestResultView,
  ModelView,
  ProviderConnectionTemplateView,
  ProviderConnectionView,
  ProviderType,
} from "@/types/app";

const defaultProvider = "OPENAI_COMPATIBLE" as ProviderType;
type ModelFormFieldKey = "baseUrl" | "apiKey" | "modelName";
type ConnectionFormFieldKey = "baseUrl" | "apiKey" | "probeModelName";

function getAvatarPreviewStyle(provider: ProviderType, avatarColor: string) {
  const palette = getModelAvatarPalette(provider, avatarColor);

  return {
    backgroundColor: palette.baseColor,
    color: palette.textColor,
    boxShadow: `0 12px 28px ${palette.shadowColor}`,
  };
}

function getAvatarLabelPreview(avatarLabel: string | undefined, provider: ProviderType) {
  return normalizeModelAvatarLabel(avatarLabel) ?? getProviderDefaultAvatarLabel(provider);
}

function getTemplateAvatarDefaults(template: ProviderConnectionTemplateView | null, provider: ProviderType) {
  return {
    avatarLabel: normalizeModelAvatarLabel(template?.avatarLabel) ?? getProviderDefaultAvatarLabel(provider),
    avatarColor: template?.avatarColor ?? getProviderDefaultAvatarColor(provider),
  };
}

function createDefaultModelForm() {
  const preset = getProviderPreset(defaultProvider);
  return {
    id: "",
    connectionId: "",
    name: "",
    provider: defaultProvider,
    baseUrl: preset.baseUrl,
    modelName: preset.defaultModelName,
    avatarLabel: getProviderDefaultAvatarLabel(defaultProvider),
    avatarColor: getProviderDefaultAvatarColor(defaultProvider),
    apiKey: "",
    defaultReplyLength: preset.defaultReplyLength,
    enabled: true,
  };
}


function createDefaultConnectionForm() {
  const preset = getProviderPreset(defaultProvider);
  return {
    id: "",
    templateId: "",
    name: "",
    provider: defaultProvider,
    baseUrl: preset.baseUrl,
    apiKey: "",
    enabled: true,
    probeModelName: preset.defaultModelName,
  };
}

const customProviderChoices: ProviderType[] = ["OPENAI_COMPATIBLE", "CLAUDE", "GEMINI", "GROK"];

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const tone =
    feedback.tone === "warning"
      ? "border-amber-200/50 bg-amber-50/80 text-amber-900"
      : "border-red-200/50 bg-red-50/80 text-red-900";

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <p className="text-[13px] font-bold">{feedback.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
    </div>
  );
}

function TestState({ state, running }: { state: ModelTestResultView | null; running: boolean }) {
  if (running) {
    return <span className="rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-600 tracking-wide uppercase animate-pulse">测试中</span>;
  }
  if (!state) {
    return <span className="rounded-md bg-black/5 border border-black/10 px-2 py-0.5 text-[10px] font-bold text-[var(--muted)] tracking-wide uppercase">未测试</span>;
  }
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
        state.status === "success"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
          : "bg-red-500/10 border-red-500/20 text-red-600"
      }`}
    >
      {state.status === "success" ? "连接成功" : "连接失败"}
    </span>
  );
}

function ModelInsightNotice({ insight }: { insight: ModelOperationalInsight }) {
  const toneClass =
    insight.tone === "warning"
      ? "border-amber-200/70 bg-amber-50/80 text-amber-900"
      : "border-red-200/70 bg-red-50/80 text-red-900";
  const badgeClass =
    insight.tone === "warning"
      ? "border-amber-300/70 bg-amber-100/70 text-amber-800"
      : "border-red-300/70 bg-red-100/80 text-red-700";

  return (
    <div className={`mt-3 ml-2 rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${badgeClass}`}>
          {insight.shortLabel}
        </span>
        <p className="text-[12px] font-bold">{insight.title}</p>
      </div>
      <p className="mt-1 text-[12px] leading-6 opacity-90">{insight.description}</p>
      <p className="mt-1 text-[11px] leading-5 opacity-75">建议：{insight.suggestion}</p>
    </div>
  );
}

function FieldErrorHint({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="ml-1 text-[11px] leading-5 text-red-600">{message}</p>;
}

function getInputErrorClass(message?: string) {
  return message
    ? "border-red-300/70 bg-red-50/70 text-red-950 placeholder:text-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200/70"
    : "";
}

function getGlassMenuOptionClassName(isActive: boolean) {
  return `group flex w-full items-start gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-all duration-200 ${
    isActive
      ? "border-[color:color-mix(in_srgb,var(--accent)_24%,white_76%)] bg-[color:color-mix(in_srgb,var(--accent)_12%,white_88%)] shadow-[0_12px_30px_rgba(220,117,165,0.12)]"
      : "border-transparent bg-white/35 hover:-translate-y-[1px] hover:border-white/70 hover:bg-white/78 hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
  }`;
}

function MenuCheck({ visible }: { visible: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
        visible
          ? "border-[var(--accent)]/30 bg-[var(--accent)]/14 text-[var(--accent)] opacity-100"
          : "border-transparent bg-transparent text-transparent opacity-0 group-hover:opacity-100"
      }`}
      aria-hidden="true"
    >
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
        <path d="M5 10.5L8.5 14L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function createSavedVerificationFeedback(
  target: "模型" | "连接",
  name: string,
  error: unknown,
): ClientErrorFeedback {
  const base = describeClientError(error);

  if (base.title === "API Key 无效或鉴权失败") {
    return {
      title: `${target}已保存，但 API Key 验证未通过`,
      description: `${target}「${name}」已保存，但当前 API Key 没有通过验证。${base.description}`,
      suggestion: `请优先检查 API Key 是否正确、是否填到了对应厂商的平台账号下，并确认 Base URL、模型 ID 与厂商匹配。`,
      tone: "warning",
    };
  }

  if (base.title === "模型请求超时或网络连接失败") {
    return {
      title: `${target}已保存，但 Base URL 或网络验证未通过`,
      description: `${target}「${name}」已保存，但连接验证没有通过。${base.description}`,
      suggestion: "请优先检查 Base URL、当前网络、服务器到上游接口的连通性，再重新验证。",
      tone: "warning",
    };
  }

  if (base.title === "目标内容不存在") {
    return {
      title: `${target}已保存，但模型 ID 或接口地址不可用`,
      description: `${target}「${name}」已保存，但当前模型 ID、接口地址或对应资源不可用。${base.description}`,
      suggestion: "请确认模型 ID 是否真实存在，并检查 Base URL 与厂商模板是否匹配后再重试。",
      tone: "warning",
    };
  }

  if (base.title === "平台未返回模型列表") {
    return {
      title: `${target}已保存，但平台没有返回模型列表`,
      description: `${target}「${name}」已保存，但当前平台没有返回可用模型列表。${base.description}`,
      suggestion: "如果该平台支持手动填写模型 ID，请直接填写并继续；如果本应支持自动获取，请先检查 Key 权限和平台状态。",
      tone: "warning",
    };
  }

  return {
    title: `${target}已保存，但验证未通过`,
    description: `${target}「${name}」已保存。${base.description}`,
    suggestion: `配置已经保存，但当前 Key 或连接参数可能仍有问题。${base.suggestion}`,
    tone: "warning",
  };
}

function createSavedNotice(
  target: "模型" | "连接",
  action: "创建" | "更新",
  name: string,
  verified: boolean,
) {
  return verified
    ? `已${action}${target}「${name}」，并已通过连接验证。`
    : `已${action}${target}「${name}」，但连接验证未通过。`;
}

function createPlainSavedNotice(target: "模型" | "连接", action: "创建" | "更新", name: string) {
  return `已${action}${target}「${name}」。`;
}

function resolveModelFieldErrors(
  feedback: ClientErrorFeedback,
  scope: "submit" | "discover",
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

  return {};
}

function resolveConnectionFieldErrors(
  feedback: ClientErrorFeedback,
): Partial<Record<ConnectionFormFieldKey, string>> {
  if (feedback.title.includes("API Key")) {
    return { apiKey: "请检查 API Key 是否正确，并确认它属于当前厂商或平台。" };
  }

  if (feedback.title.includes("Base URL") || feedback.title.includes("网络")) {
    return { baseUrl: "请确认接口地址是否正确，并检查当前网络或上游平台连通性。" };
  }

  if (feedback.title.includes("目标内容不存在")) {
    return { probeModelName: "测试用模型 ID 不可用，请换一个已开通的模型再验证。" };
  }

  return {};
}

function createVerificationPassedNotice(target: "模型" | "连接", name: string) {
  return `${target}「${name}」连接验证通过。`;
}

function createDiscoveryNotice(source: "连接" | "模型配置" | "当前填写参数", count: number) {
  return `已通过${source}获取到 ${count} 个模型，请从下方选择。`;
}


export function ModelsPage() {
  const mockToolsEnabled = supportsLocalMockTools();
  const [models, setModels] = useState<ModelView[]>([]);
  const [connections, setConnections] = useState<ProviderConnectionView[]>([]);
  const [connectionTemplates, setConnectionTemplates] = useState<ProviderConnectionTemplateView[]>(
    providerConnectionTemplates,
  );
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [modelSubmitFeedback, setModelSubmitFeedback] = useState<ClientErrorFeedback | null>(null);
  const [modelDiscoveryFeedback, setModelDiscoveryFeedback] = useState<ClientErrorFeedback | null>(null);
  const [connectionFormFeedback, setConnectionFormFeedback] = useState<ClientErrorFeedback | null>(null);
  const [modelFieldErrors, setModelFieldErrors] = useState<Partial<Record<ModelFormFieldKey, string>>>({});
  const [connectionFieldErrors, setConnectionFieldErrors] = useState<
    Partial<Record<ConnectionFormFieldKey, string>>
  >({});
  // "model" = 直接建模型主流程（默认）；"connection" = 管理已保存连接的可选面板
  const [builderMode, setBuilderMode] = useState<"connection" | "model">("model");
  const [modelForm, setModelForm] = useState(createDefaultModelForm);
  const [connectionForm, setConnectionForm] = useState(createDefaultConnectionForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderType | "ALL">("ALL");
  const [runningTestModelId, setRunningTestModelId] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelView[]>([]);
  const [runningTestConnectionId, setRunningTestConnectionId] = useState<string | null>(null);
  const [connectionDiscoveredModels, setConnectionDiscoveredModels] = useState<
    Record<string, DiscoveredModelView[]>
  >({});
  // 是否在 model 模式下展开"使用已保存连接"面板
  const [showSavedConnections, setShowSavedConnections] = useState(false);
  const [selectedModelTemplateId, setSelectedModelTemplateId] = useState("");
  const [showModelProviderMenu, setShowModelProviderMenu] = useState(false);
  const modelProviderMenuRef = useRef<HTMLDivElement | null>(null);
  const [showDiscoveredModelMenu, setShowDiscoveredModelMenu] = useState(false);
  const discoveredModelMenuRef = useRef<HTMLDivElement | null>(null);
  const modelFormPanelRef = useRef<HTMLDivElement | null>(null);
  const connectionFormPanelRef = useRef<HTMLDivElement | null>(null);

  const selectedConnection = useMemo(

    () => connections.find((connection) => connection.id === modelForm.connectionId) ?? null,
    [connections, modelForm.connectionId],
  );
  const selectedConnectionTemplate = useMemo(() => {
    if (connectionForm.templateId) {
      return connectionTemplates.find((template) => template.id === connectionForm.templateId) ?? null;
    }

    const normalizedBaseUrl = connectionForm.baseUrl.trim().replace(/\/+$/, "").toLowerCase();

    return (
      connectionTemplates.find((template) => {
        if (template.provider !== connectionForm.provider || !template.suggestedBaseUrl) {
          return false;
        }

        return template.suggestedBaseUrl.trim().replace(/\/+$/, "").toLowerCase() === normalizedBaseUrl;
      }) ?? null
    );
  }, [connectionForm.baseUrl, connectionForm.provider, connectionForm.templateId, connectionTemplates]);

  const selectedModelTemplate = useMemo(() => {
    if (modelForm.connectionId) {
      return null;
    }

    if (selectedModelTemplateId) {
      return connectionTemplates.find((template) => template.id === selectedModelTemplateId) ?? null;
    }

    const normalizedBaseUrl = modelForm.baseUrl.trim().replace(/\/+$/, "").toLowerCase();

    return (
      connectionTemplates.find((template) => {
        if (template.provider !== modelForm.provider || !template.suggestedBaseUrl) {
          return false;
        }

        return template.suggestedBaseUrl.trim().replace(/\/+$/, "").toLowerCase() === normalizedBaseUrl;
      }) ?? null
    );
  }, [connectionTemplates, modelForm.baseUrl, modelForm.connectionId, modelForm.provider, selectedModelTemplateId]);


  const groupedConnectionTemplates = useMemo(
    () => ({
      domestic: connectionTemplates.filter((template) => template.category === "DOMESTIC"),
      global: connectionTemplates.filter((template) => template.category === "GLOBAL"),
    }),
    [connectionTemplates],
  );

  const connectionProviderChoiceValue = selectedConnectionTemplate
    ? `template:${selectedConnectionTemplate.id}`
    : `provider:${connectionForm.provider}`;

  // 当前表单对应的 discovery 能力

  const discoverySupported = selectedConnection
    ? selectedConnection.supportsAutomaticModelDiscovery
    : selectedModelTemplate
      ? selectedModelTemplate.preferredDiscoveryStrategy !== "MANUAL_ONLY"
      : supportsAutomaticModelDiscovery(modelForm.provider);

  const selectedPreset = getProviderPreset(modelForm.provider);
  const currentAvatarStyle = getAvatarPreviewStyle(modelForm.provider, modelForm.avatarColor);
  const currentAvatarLabel = getAvatarLabelPreview(modelForm.avatarLabel, modelForm.provider);
  const selectedModelChoiceLabel = selectedModelTemplate?.name ?? getProviderOptionLabel(modelForm.provider);
  const selectedModelChoiceSubtitle =
    selectedModelTemplate?.subtitle ?? "自定义接入模式，可手动填写 Base URL、API Key 和模型 ID。";
  const selectedSavedConnectionTemplate = selectedConnection
    ? findTemplateByProviderAndBaseUrl(selectedConnection.provider, selectedConnection.baseUrl)
    : null;
  const selectedSavedConnectionAvatar = selectedConnection
    ? getTemplateAvatarDefaults(selectedSavedConnectionTemplate, selectedConnection.provider)
    : null;
  const selectedDiscoveredModel = useMemo(
    () => discoveredModels.find((item) => item.id === modelForm.modelName) ?? null,
    [discoveredModels, modelForm.modelName],
  );

  const connectionDiscoverySupported = selectedConnectionTemplate



    ? selectedConnectionTemplate.preferredDiscoveryStrategy !== "MANUAL_ONLY"
    : supportsAutomaticModelDiscovery(connectionForm.provider);
  const connectionFormAvatar = getTemplateAvatarDefaults(selectedConnectionTemplate, connectionForm.provider);

  useEffect(() => {
    if (!showModelProviderMenu && !showDiscoveredModelMenu) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (modelProviderMenuRef.current && !modelProviderMenuRef.current.contains(event.target as Node)) {
        setShowModelProviderMenu(false);
      }
      if (discoveredModelMenuRef.current && !discoveredModelMenuRef.current.contains(event.target as Node)) {
        setShowDiscoveredModelMenu(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowModelProviderMenu(false);
        setShowDiscoveredModelMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showDiscoveredModelMenu, showModelProviderMenu]);

  useEffect(() => {
    if (builderMode === "model" && (modelSubmitFeedback || modelDiscoveryFeedback)) {
      modelFormPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (builderMode === "connection" && connectionFormFeedback) {
      connectionFormPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [builderMode, connectionFormFeedback, modelDiscoveryFeedback, modelSubmitFeedback]);

  function findTemplateById(templateId: string) {
    return connectionTemplates.find((template) => template.id === templateId) ?? null;
  }

  function findTemplateByProviderAndBaseUrl(provider: ProviderType, baseUrl: string) {
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "").toLowerCase();

    return (
      connectionTemplates.find((template) => {
        if (template.provider !== provider || !template.suggestedBaseUrl) {
          return false;
        }

        return template.suggestedBaseUrl.trim().replace(/\/+$/, "").toLowerCase() === normalizedBaseUrl;
      }) ?? null
    );
  }

  async function loadModels() {
    const data = await fetchJson<{ models: ModelView[] }>("/api/models");
    setModels(data.models);
  }

  async function loadConnections() {
    const data = await fetchProviderConnectionsRequest();
    setConnections(data.connections);
  }

  async function loadProviderCatalog() {
    try {
      const data = await fetchProviderCatalogRequest();
      setConnectionTemplates(data.templates);
    } catch {
      setConnectionTemplates(providerConnectionTemplates);
    }
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);
    try {
      await Promise.all([loadModels(), loadConnections(), loadProviderCatalog()]);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  });

  useEffect(() => {
    startTransition(() => {
      void handleInitialLoad();
    });
  }, []);

  const filteredModels = useMemo(() => {

    return models.filter((model) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        [model.name, model.modelName, model.baseUrl].join(" ").toLowerCase().includes(query);
      const matchesProvider = providerFilter === "ALL" || model.provider === providerFilter;
      return matchesQuery && matchesProvider;
    });
  }, [models, providerFilter, searchQuery]);

  function clearModelInlineFeedback() {
    setModelSubmitFeedback(null);
    setModelDiscoveryFeedback(null);
    setModelFieldErrors({});
  }

  function clearConnectionInlineFeedback() {
    setConnectionFormFeedback(null);
    setConnectionFieldErrors({});
  }

  const modelStats = useMemo(() => {
    const enabledCount = models.filter((model) => model.enabled).length;
    const testedSuccessCount = models.filter((model) => model.lastConnectionTest?.status === "success").length;
    const providerCount = new Set(models.map((model) => model.provider)).size;

    return {
      enabledCount,
      testedSuccessCount,
      providerCount,
    };
  }, [models]);

  function updateModelForm(nextValue: Partial<ReturnType<typeof createDefaultModelForm>>) {
    clearModelInlineFeedback();
    if (
      nextValue.provider ||
      nextValue.baseUrl !== undefined ||
      nextValue.apiKey !== undefined ||
      nextValue.connectionId !== undefined
    ) {
      setDiscoveredModels([]);
    }
    setModelForm((current) => ({ ...current, ...nextValue }));
  }

  function resetForm() {
    setModelForm(createDefaultModelForm());
    setSelectedModelTemplateId("");
    setDiscoveredModels([]);
    setShowSavedConnections(false);
    clearModelInlineFeedback();
  }


  function updateConnectionForm(nextValue: Partial<ReturnType<typeof createDefaultConnectionForm>>) {
    clearConnectionInlineFeedback();
    setConnectionForm((current) => ({ ...current, ...nextValue }));
  }

  function resetConnectionForm() {
    setConnectionForm(createDefaultConnectionForm());
    clearConnectionInlineFeedback();
  }

  function updateProvider(nextProvider: ProviderType) {
    const currentPreset = getProviderPreset(modelForm.provider);
    const nextPreset = getProviderPreset(nextProvider);
    setSelectedModelTemplateId("");
    updateModelForm({
      connectionId: "",
      provider: nextProvider,
      baseUrl: nextPreset.baseUrl,
      avatarLabel: getProviderDefaultAvatarLabel(nextProvider),
      avatarColor: getProviderDefaultAvatarColor(nextProvider),
      modelName:
        !modelForm.modelName || modelForm.modelName === currentPreset.defaultModelName
          ? nextPreset.defaultModelName
          : modelForm.modelName,
      defaultReplyLength:
        modelForm.defaultReplyLength === currentPreset.defaultReplyLength
          ? nextPreset.defaultReplyLength
          : modelForm.defaultReplyLength,
    });
  }


  function updateConnectionProvider(nextProvider: ProviderType) {
    const currentPreset = getProviderPreset(connectionForm.provider);
    const nextPreset = getProviderPreset(nextProvider);
    updateConnectionForm({
      templateId: "",
      provider: nextProvider,
      baseUrl: nextPreset.baseUrl,
      probeModelName:
        !connectionForm.probeModelName || connectionForm.probeModelName === currentPreset.defaultModelName
          ? nextPreset.defaultModelName
          : connectionForm.probeModelName,
    });
  }

  function handleModelProviderChoice(nextValue: string) {
    if (nextValue.startsWith("template:")) {
      applyModelTemplate(nextValue.slice("template:".length));
      setShowModelProviderMenu(false);
      return;
    }

    if (nextValue.startsWith("provider:")) {
      updateProvider(nextValue.slice("provider:".length) as ProviderType);
      setShowModelProviderMenu(false);
    }
  }

  function switchBuilderMode(nextMode: "connection" | "model") {
    setBuilderMode(nextMode);
    setFeedback(null);
    if (nextMode === "model") {
      clearConnectionInlineFeedback();
    } else {
      clearModelInlineFeedback();
    }
  }

  function applyConnectionTemplate(templateId: string) {
    const template = findTemplateById(templateId);

    if (!template) {
      return;
    }

    const preset = getProviderPreset(template.provider);
    updateConnectionForm({
      templateId: template.id,
      name: connectionForm.name.trim() ? connectionForm.name : template.name,
      provider: template.provider,
      baseUrl: template.suggestedBaseUrl ?? "",
      probeModelName: template.defaultModelName ?? preset.defaultModelName,
    });
    setNotice(`已套用「${template.name}」模板。`);
    setFeedback(null);
  }

  function applyModelTemplate(templateId: string) {
    const template = findTemplateById(templateId);

    if (!template) {
      return;
    }

    const preset = getProviderPreset(template.provider);
    const avatarDefaults = getTemplateAvatarDefaults(template, template.provider);
    setSelectedModelTemplateId(template.id);
    updateModelForm({
      connectionId: "",
      provider: template.provider,
      baseUrl: template.suggestedBaseUrl ?? preset.baseUrl,
      modelName: template.defaultModelName ?? preset.defaultModelName,
      avatarLabel: avatarDefaults.avatarLabel,
      avatarColor: avatarDefaults.avatarColor,
      apiKey: "",
    });
    setDiscoveredModels([]);
    setNotice(`已套用「${template.name}」模板。`);
    setFeedback(null);
  }

  function handleConnectionProviderChoice(nextValue: string) {
    if (nextValue.startsWith("template:")) {
      applyConnectionTemplate(nextValue.slice("template:".length));
      return;
    }

    if (nextValue.startsWith("provider:")) {
      updateConnectionProvider(nextValue.slice("provider:".length) as ProviderType);
    }
  }


  async function submitModelForm() {
    setActiveAction(modelForm.id ? "updating" : "creating");
    setFeedback(null);
    clearModelInlineFeedback();
    try {
      const derivedModelName = modelForm.modelName.trim();
      const derivedDisplayName =
        modelForm.name.trim() ||
        derivedModelName ||
        selectedModelTemplate?.name ||
        getProviderChineseLabel(modelForm.provider);
      const payload = {
        name: derivedDisplayName,
        modelName: derivedModelName,
        ...(modelForm.avatarLabel.trim() ? { avatarLabel: modelForm.avatarLabel.trim() } : {}),
        avatarColor: modelForm.avatarColor,
        defaultReplyLength: modelForm.defaultReplyLength,
        enabled: modelForm.enabled,
        ...(modelForm.connectionId

          ? { connectionId: modelForm.connectionId }
          : {
              provider: modelForm.provider,
              baseUrl: modelForm.baseUrl,
              ...(modelForm.apiKey ? { apiKey: modelForm.apiKey } : {}),
            }),
      };
      const result = modelForm.id
        ? await fetchJson<{ model: ModelView }>(`/api/models/${modelForm.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await fetchJson<{ model: ModelView }>("/api/models", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      resetForm();
      await Promise.all([loadModels(), loadConnections()]);
      setBuilderMode("model");

      if (!modelForm.connectionId && modelForm.apiKey.trim()) {
        try {
          await fetchJson(`/api/models/${result.model.id}/test`, { method: "POST", body: JSON.stringify({}) });
          await loadModels();
          setNotice(createSavedNotice("模型", modelForm.id ? "更新" : "创建", derivedDisplayName, true));
        } catch (error: unknown) {
          await loadModels();
          setNotice(createSavedNotice("模型", modelForm.id ? "更新" : "创建", derivedDisplayName, false));
          const nextFeedback = createSavedVerificationFeedback("模型", derivedDisplayName, error);
          setModelSubmitFeedback(nextFeedback);
          setModelFieldErrors(resolveModelFieldErrors(nextFeedback, "submit"));
        }
      } else {
        setNotice(createPlainSavedNotice("模型", modelForm.id ? "更新" : "创建", derivedDisplayName));
      }
    } catch (error: unknown) {
      const nextFeedback = describeClientError(error);
      setModelSubmitFeedback(nextFeedback);
      setModelFieldErrors(resolveModelFieldErrors(nextFeedback, "submit"));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDiscoverModels() {
    if (modelForm.connectionId) {
      setActiveAction("discovering");
      clearModelInlineFeedback();
      try {
        const data = await discoverProviderModelsByConnectionRequest(modelForm.connectionId);
        setDiscoveredModels(data.models);
        setConnectionDiscoveredModels((current) => ({
          ...current,
          [modelForm.connectionId]: data.models,
        }));
        if (data.models[0] && !data.models.some((item) => item.id === modelForm.modelName)) {
          updateModelForm({ modelName: data.models[0].id });
        }
        setNotice(createDiscoveryNotice("连接", data.models.length));
      } catch (error: unknown) {
        setDiscoveredModels([]);
        const nextFeedback = describeClientError(error);
        setModelDiscoveryFeedback(nextFeedback);
        setModelFieldErrors(resolveModelFieldErrors(nextFeedback, "discover"));
      } finally {
        setActiveAction(null);
      }
      return;
    }

    if (modelForm.id && !modelForm.apiKey.trim()) {
      setActiveAction("discovering");
      clearModelInlineFeedback();
      try {
        const data = await discoverProviderModelsBySavedModelRequest(modelForm.id);
        setDiscoveredModels(data.models);
        if (data.models[0] && !data.models.some((item) => item.id === modelForm.modelName)) {
          updateModelForm({ modelName: data.models[0].id });
        }
        setNotice(
          `${createDiscoveryNotice("模型配置", data.models.length)} 若你刚修改了 Base URL 或厂商，请先重新填写 API Key 再获取。`,
        );
      } catch (error: unknown) {
        setDiscoveredModels([]);
        const nextFeedback = describeClientError(error);
        setModelDiscoveryFeedback(nextFeedback);
        setModelFieldErrors(resolveModelFieldErrors(nextFeedback, "discover"));
      } finally {
        setActiveAction(null);
      }
      return;
    }

    if (!modelForm.baseUrl.trim() || !modelForm.apiKey.trim()) {
      const nextFeedback = {
        title: "请先填入连接信息",
        description: "自动获取模型列表需要 Base URL 和 API Key。",
        suggestion: "先确认 Base URL 已自动填入或手动调整，再填写 API Key 并点击获取模型列表。",
        tone: "warning",
      } satisfies ClientErrorFeedback;
      setModelDiscoveryFeedback(nextFeedback);
      setModelFieldErrors(resolveModelFieldErrors(nextFeedback, "discover"));
      return;
    }


    setActiveAction("discovering");
    clearModelInlineFeedback();
    try {
      const data = await discoverProviderModels({
        provider: modelForm.provider,
        baseUrl: modelForm.baseUrl,
        apiKey: modelForm.apiKey,
      });


      setDiscoveredModels(data.models);
      if (data.models[0] && !data.models.some((item) => item.id === modelForm.modelName)) {
        updateModelForm({ modelName: data.models[0].id });
      }
      setNotice(createDiscoveryNotice("当前填写参数", data.models.length));
    } catch (error: unknown) {
      setDiscoveredModels([]);
      const nextFeedback = describeClientError(error);
      setModelDiscoveryFeedback(nextFeedback);
      setModelFieldErrors(resolveModelFieldErrors(nextFeedback, "discover"));
    } finally {
      setActiveAction(null);
    }
  }

  async function testModel(model: ModelView) {
    setActiveAction("testing");
    setRunningTestModelId(model.id);
    setFeedback(null);
    try {
      await fetchJson(`/api/models/${model.id}/test`, { method: "POST", body: JSON.stringify({}) });
      await loadModels();
      setNotice(createVerificationPassedNotice("模型", model.name));
    } catch (error: unknown) {
      await loadModels();
      setFeedback(describeClientError(error));
    } finally {
      setRunningTestModelId(null);
      setActiveAction(null);
    }
  }

  async function toggleModel(model: ModelView) {
    setActiveAction("toggle");
    setFeedback(null);
    try {
      await fetchJson(`/api/models/${model.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !model.enabled }),
      });
      await loadModels();
      setNotice(`${model.name} 已${model.enabled ? "停用" : "启用"}。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function removeModel(model: ModelView) {
    if (!window.confirm(`确认删除模型「${model.name}」吗？`)) return;
    setActiveAction("deleting");
    setFeedback(null);
    try {
      await fetchJson(`/api/models/${model.id}`, { method: "DELETE" });
      if (modelForm.id === model.id) resetForm();
      await Promise.all([loadModels(), loadConnections()]);
      setNotice(`已删除模型「${model.name}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function createLocalMocks() {
    setActiveAction("local-mocks");
    setFeedback(null);
    try {
      await ensureLocalMockModels();
      await loadModels();
      setNotice("本地测试模型已经准备好。");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  function fillLocalMockPreset() {
    setBuilderMode("model");
    setSelectedModelTemplateId("");
    setShowSavedConnections(false);
    setModelForm({
      id: "",
      connectionId: "",
      name: "Mock Alpha",
      provider: "OPENAI_COMPATIBLE",
      baseUrl: getLocalMockBaseUrl(),
      modelName: "mock-alpha",
      avatarLabel: "MO",
      avatarColor: getProviderDefaultAvatarColor("OPENAI_COMPATIBLE"),
      apiKey: "local-test-key",
      defaultReplyLength: 180,
      enabled: true,
    });

    setDiscoveredModels([
      { id: "mock-alpha", label: "mock-alpha", description: "local-mock" },
      { id: "mock-beta", label: "mock-beta", description: "local-mock" },
      { id: "mock-gamma", label: "mock-gamma", description: "local-mock" },
    ]);
    setNotice("已填入本地测试模型参数。");
    setFeedback(null);
  }

  async function submitConnectionForm() {
    setActiveAction(connectionForm.id ? "connection-updating" : "connection-creating");
    setFeedback(null);
    clearConnectionInlineFeedback();
    try {
      const payload: CreateProviderConnectionPayload = {
        name: connectionForm.name,
        provider: connectionForm.provider,
        baseUrl: connectionForm.baseUrl,
        apiKey: connectionForm.apiKey,
        discoveryStrategy: selectedConnectionTemplate?.preferredDiscoveryStrategy,
        enabled: connectionForm.enabled,
      };

      const result = connectionForm.id
        ? await updateProviderConnectionRequest(connectionForm.id, {
          ...payload,
          apiKey: connectionForm.apiKey.trim() ? connectionForm.apiKey : undefined,
        })
        : await createProviderConnectionRequest(payload);

      if (connectionForm.id) {
        if (modelForm.connectionId === result.connection.id) {
          updateModelForm({
            connectionId: result.connection.id,
            provider: result.connection.provider,
            baseUrl: result.connection.baseUrl,
          });
        }
      } else {
        setBuilderMode("model");
      }

      resetConnectionForm();
      await loadConnections();

      if (connectionForm.apiKey.trim()) {
        try {
          await testProviderConnectionRequest(result.connection.id, {
            modelName: result.connection.supportsAutomaticModelDiscovery
              ? undefined
              : connectionForm.probeModelName.trim() || selectedConnectionTemplate?.defaultModelName || undefined,
          });
          await loadConnections();
          setNotice(createSavedNotice("连接", connectionForm.id ? "更新" : "创建", connectionForm.name, true));
        } catch (error: unknown) {
          await loadConnections();
          setNotice(createSavedNotice("连接", connectionForm.id ? "更新" : "创建", connectionForm.name, false));
          const nextFeedback = createSavedVerificationFeedback("连接", connectionForm.name, error);
          setConnectionFormFeedback(nextFeedback);
          setConnectionFieldErrors(resolveConnectionFieldErrors(nextFeedback));
        }
      } else if (connectionForm.id) {
        setNotice(createPlainSavedNotice("连接", "更新", connectionForm.name));
      } else {
        setNotice(`已创建连接「${connectionForm.name}」，可在“使用已保存连接”中选择复用。`);
      }
    } catch (error: unknown) {
      const nextFeedback = describeClientError(error);
      setConnectionFormFeedback(nextFeedback);
      setConnectionFieldErrors(resolveConnectionFieldErrors(nextFeedback));
    } finally {
      setActiveAction(null);
    }
  }

  async function testConnection(connection: ProviderConnectionView) {
    setActiveAction("connection-testing");
    setRunningTestConnectionId(connection.id);
    setFeedback(null);
    try {
      await testProviderConnectionRequest(connection.id, {
        modelName: connection.supportsAutomaticModelDiscovery
          ? undefined
          : connectionForm.id === connection.id
            ? connectionForm.probeModelName.trim() || undefined
            : undefined,
      });
      await loadConnections();
      setNotice(createVerificationPassedNotice("连接", connection.name));
    } catch (error: unknown) {
      await loadConnections();
      setFeedback(describeClientError(error));
    } finally {
      setRunningTestConnectionId(null);
      setActiveAction(null);
    }
  }

  async function discoverConnectionModels(connection: ProviderConnectionView) {
    setActiveAction("connection-discovering");
    setFeedback(null);
    try {
      const data = await discoverProviderModelsByConnectionRequest(connection.id);
      setConnectionDiscoveredModels((current) => ({
        ...current,
        [connection.id]: data.models,
      }));
      if (modelForm.connectionId === connection.id) {
        setDiscoveredModels(data.models);
      }
      setNotice(`连接「${connection.name}」已获取到 ${data.models.length} 个模型。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function removeConnection(connection: ProviderConnectionView) {
    if (!window.confirm(`确认删除连接「${connection.name}」吗？`)) return;
    setActiveAction("connection-deleting");
    setFeedback(null);
    try {
      await deleteProviderConnectionRequest(connection.id);
      if (connectionForm.id === connection.id) {
        resetConnectionForm();
      }
      if (modelForm.connectionId === connection.id) {
        updateModelForm({ connectionId: "" });
      }
      setConnectionDiscoveredModels((current) => {
        const next = { ...current };
        delete next[connection.id];
        return next;
      });
      await loadConnections();
      setNotice(`已删除连接「${connection.name}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  function startEditingConnection(connection: ProviderConnectionView) {
    setBuilderMode("connection");
    const matchedTemplate = findTemplateByProviderAndBaseUrl(connection.provider, connection.baseUrl);
    updateConnectionForm({
      id: connection.id,
      templateId: matchedTemplate?.id ?? "",
      name: connection.name,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      apiKey: "",
      enabled: connection.enabled,
      probeModelName: getProviderPreset(connection.provider).defaultModelName,
    });
    setNotice(`正在编辑连接「${connection.name}」。`);
    setFeedback(null);
  }

  function attachConnectionToModel(connection: ProviderConnectionView, modelId?: string) {
    setBuilderMode("model");
    const matchedTemplate = findTemplateByProviderAndBaseUrl(connection.provider, connection.baseUrl);
    const avatarDefaults = getTemplateAvatarDefaults(matchedTemplate, connection.provider);
    setSelectedModelTemplateId(matchedTemplate?.id ?? "");
    setShowSavedConnections(true);
    updateModelForm({
      connectionId: connection.id,
      provider: connection.provider,
      baseUrl: connection.baseUrl,
      avatarLabel: avatarDefaults.avatarLabel,
      avatarColor: avatarDefaults.avatarColor,
      modelName: modelId ?? modelForm.modelName,
    });

    if (connectionDiscoveredModels[connection.id]) {
      setDiscoveredModels(connectionDiscoveredModels[connection.id] ?? []);
    }
    setNotice(`已选择连接「${connection.name}」${modelId ? `并填入模型 ID「${modelId}」` : ""}。`);
    setFeedback(null);
  }

  function selectSavedConnectionForModel(connectionId: string) {
    if (!connectionId) {
      updateModelForm({ connectionId: "" });
      setDiscoveredModels([]);
      return;
    }

    const connection = connections.find((item) => item.id === connectionId);
    if (connection) {
      const matchedTemplate = findTemplateByProviderAndBaseUrl(connection.provider, connection.baseUrl);
      const avatarDefaults = getTemplateAvatarDefaults(matchedTemplate, connection.provider);
      updateModelForm({
        connectionId: connection.id,
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        avatarLabel: avatarDefaults.avatarLabel,
        avatarColor: avatarDefaults.avatarColor,
      });
      if (connectionDiscoveredModels[connection.id]) {
        setDiscoveredModels(connectionDiscoveredModels[connection.id] ?? []);
      }
    }
  }

  if (activeAction === "loading" && models.length === 0) {

    return (
      <main className="ly-page-wrap">
        <div className="ly-shell flex flex-col gap-5">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
            <div className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
              <div className="ly-page-header">
                <div className="space-y-3">
                  <div className="h-8 w-36 animate-pulse rounded-xl bg-white/45" />
                  <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-white/35" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="h-11 w-28 animate-pulse rounded-xl bg-white/40" />
                  <div className="h-11 w-28 animate-pulse rounded-xl bg-white/35" />
                  <div className="h-11 w-28 animate-pulse rounded-xl bg-white/35" />
                </div>
              </div>
            </div>

            <div className="ly-surface-card grid gap-4 rounded-[1.75rem] p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-[1.4rem] bg-white/45 px-4 py-4">
                  <div className="h-3 w-20 animate-pulse rounded bg-white/50" />
                  <div className="mt-3 h-8 w-14 animate-pulse rounded bg-white/55" />
                  <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/40" />
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <div className="ly-glass ly-panel-card space-y-4">
              <div className="h-6 w-24 animate-pulse rounded-lg bg-white/45" />
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-white/40" />
                  <div className="h-11 w-full animate-pulse rounded-xl bg-white/35" />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="h-11 flex-1 animate-pulse rounded-xl bg-white/35" />
                <div className="h-11 w-40 animate-pulse rounded-xl bg-white/35" />
              </div>
              {[1, 2, 3].map((item) => (
                <div key={item} className="ly-glass ly-panel-card overflow-hidden">
                  <div className="space-y-4 pl-2">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 animate-pulse rounded-xl bg-white/45" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-40 animate-pulse rounded bg-white/50" />
                        <div className="h-3 w-52 animate-pulse rounded bg-white/35" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="h-16 animate-pulse rounded-2xl bg-white/35" />
                      <div className="h-16 animate-pulse rounded-2xl bg-white/35" />
                    </div>
                    <div className="flex justify-end gap-2">
                      {[1, 2, 3, 4].map((button) => (
                        <div key={button} className="h-8 w-14 animate-pulse rounded-xl bg-white/35" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
      {/* ─ Page header ─ */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
        <div className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          <div className="ly-page-header">
            <div className="ly-page-heading">
              <h1 className="ly-page-title">模型管理</h1>
              <p className="ly-page-subtitle">
                共 {models.length} 个模型 · 配置、测试并管理你的多模型入口
              </p>
            </div>
            <div className="ly-page-actions">
              <Link href="/rooms/new" className="ly-page-action rounded-xl border border-transparent bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95">
                新建房间
              </Link>
              <button type="button" onClick={fillLocalMockPreset} className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold shadow-sm shadow-black/5 active:scale-95">
                测试预设
              </button>
              {mockToolsEnabled && (
                <button type="button" onClick={() => startTransition(() => void createLocalMocks())} className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold shadow-sm shadow-black/5 active:scale-95">
                  Mock 模型
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="ly-surface-card grid gap-4 rounded-[1.75rem] p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-1">
          <div className="rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">已启用</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{modelStats.enabledCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">已可参与房间协作的模型数量。</p>
          </div>
          <div className="rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">连接正常</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{modelStats.testedSuccessCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">最近连接测试成功的模型数量。</p>
          </div>
          <div className="rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">Provider</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{modelStats.providerCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">当前已接入的不同模型厂商数量。</p>
          </div>
        </div>
      </section>

      {notice && (
        <div className="rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10 px-4 py-2 text-[12px] font-medium text-[var(--accent)]">
          {notice}
        </div>
      )}

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      {/* ─ Form + List layout ─ */}
      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="flex flex-col gap-5">

            {/* ══ 直接建模型（主流程）══ */}
            {builderMode === "model" && (
              <div ref={modelFormPanelRef} className="ly-glass ly-panel-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-display font-bold tracking-tight">
                      {modelForm.id ? "编辑模型" : "新增模型"}
                    </h2>
                    <p className="mt-0.5 text-[12px] leading-6 text-[var(--muted)]">
                      选平台模板 → 填 API Key → 获取/填模型 ID → 创建
                    </p>
                  </div>
                  {!modelForm.id && (
                    <button
                      type="button"
                      onClick={() => switchBuilderMode("connection")}
                      className="shrink-0 ly-mini-action px-3 py-1.5 text-[11px] font-bold"
                    >
                      管理连接
                    </button>
                  )}
                </div>

                <div className="mt-5 space-y-4">

                  {/* 显示名称 */}
                  <div className="space-y-1.5">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">显示名称</label>
                    <input
                      value={modelForm.name}
                      onChange={(e) => updateModelForm({ name: e.target.value })}
                      className="ly-control"
                      placeholder="可留空，将自动使用模型 ID 作为名称"
                    />
                  </div>

                  {/* 选提供商 / 平台模板 */}
                  {!selectedConnection && (
                    <div ref={modelProviderMenuRef} className="relative space-y-2">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">厂商 / 平台</label>
                      <button
                        type="button"
                        onClick={() => setShowModelProviderMenu((current) => !current)}
                        className={`ly-control flex items-center justify-between gap-3 px-4 text-left transition-all duration-200 ${
                          showModelProviderMenu
                            ? "border-[color:color-mix(in_srgb,var(--accent)_28%,white_72%)] bg-white/75 shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent_90%),0_16px_34px_rgba(220,117,165,0.12)]"
                            : "hover:bg-white/55 hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
                        }`}
                        aria-haspopup="listbox"
                        aria-expanded={showModelProviderMenu}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[9px] font-bold tracking-wide"
                            style={currentAvatarStyle}
                          >
                            {currentAvatarLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-[#2f2e33]">{selectedModelChoiceLabel}</p>
                            <p className="truncate text-[11px] leading-5 text-[var(--muted)]">{selectedModelChoiceSubtitle}</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-[var(--muted)]/75 transition-transform duration-200" style={{ transform: showModelProviderMenu ? "rotate(180deg)" : "rotate(0deg)" }}>
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {showModelProviderMenu && (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[1.3rem] border border-white/60 bg-[rgba(255,255,255,0.78)] shadow-[0_24px_60px_rgba(31,41,55,0.14)] backdrop-blur-[26px]">
                          <div className="max-h-[26rem] overflow-y-auto p-2">
                            <div className="space-y-1">
                              <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/65">国内常用</p>
                              {groupedConnectionTemplates.domestic.map((template) => {
                                const isActive = selectedModelTemplate?.id === template.id;
                                const templateAvatar = getTemplateAvatarDefaults(template, template.provider);
                                return (
                                  <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => handleModelProviderChoice(`template:${template.id}`)}
                                    className={getGlassMenuOptionClassName(isActive)}
                                  >
                                    <span
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                                      style={getAvatarPreviewStyle(template.provider, templateAvatar.avatarColor)}
                                    >
                                      {templateAvatar.avatarLabel}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[12px] font-bold text-[#2f2e33]">{template.name}</p>
                                      <p className="truncate text-[10px] leading-5 text-[var(--muted)]">{template.subtitle}</p>
                                    </div>
                                    <MenuCheck visible={isActive} />
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-2 space-y-1">
                              <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/65">海外常用</p>
                              {groupedConnectionTemplates.global.map((template) => {
                                const isActive = selectedModelTemplate?.id === template.id;
                                const templateAvatar = getTemplateAvatarDefaults(template, template.provider);
                                return (
                                  <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => handleModelProviderChoice(`template:${template.id}`)}
                                    className={getGlassMenuOptionClassName(isActive)}
                                  >
                                    <span
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                                      style={getAvatarPreviewStyle(template.provider, templateAvatar.avatarColor)}
                                    >
                                      {templateAvatar.avatarLabel}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[12px] font-bold text-[#2f2e33]">{template.name}</p>
                                      <p className="truncate text-[10px] leading-5 text-[var(--muted)]">{template.subtitle}</p>
                                    </div>
                                    <MenuCheck visible={isActive} />
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-2 space-y-1">
                              <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/65">自定义接入</p>
                              {customProviderChoices.map((provider) => {
                                const isActive = !selectedModelTemplate && modelForm.provider === provider;
                                return (
                                  <button
                                    key={provider}
                                    type="button"
                                    onClick={() => handleModelProviderChoice(`provider:${provider}`)}
                                    className={getGlassMenuOptionClassName(isActive)}
                                  >
                                    <span
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                                      style={getAvatarPreviewStyle(provider, getProviderDefaultAvatarColor(provider))}
                                    >
                                      {getProviderDefaultAvatarLabel(provider)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[12px] font-bold text-[#2f2e33]">{getProviderOptionLabel(provider)}</p>
                                      <p className="truncate text-[10px] leading-5 text-[var(--muted)]">{getProviderChineseLabel(provider)}</p>
                                    </div>
                                    <MenuCheck visible={isActive} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="ml-1 text-[11px] leading-5 text-[var(--muted)]">
                        先选厂商，系统会自动带出默认 Base URL；如果平台不支持自动获取，再手动填写模型 ID。
                      </p>
                    </div>
                  )}


                  {!selectedConnection && (
                    <div className="ly-inline-panel flex items-start gap-3 px-3.5 py-3">
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[9px] font-bold tracking-wide"
                        style={currentAvatarStyle}
                      >
                        {currentAvatarLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] font-bold text-[#2f2e33]">
                            {selectedModelTemplate?.name ?? getProviderOptionLabel(modelForm.provider)}
                          </p>
                          <span className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/8 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                            {discoverySupported ? "可尝试获取列表" : "建议手动模型 ID"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
                          {selectedModelTemplate?.subtitle ?? "自定义接入模式，适合 OpenAI 兼容或高级协议调试。"}
                        </p>
                        {selectedModelTemplate?.note && (
                          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{selectedModelTemplate.note}</p>
                        )}
                        {selectedModelTemplate && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <a href={selectedModelTemplate.officialUrl} target="_blank" rel="noreferrer" className="ly-mini-action px-2.5 py-1 text-[10px] font-bold">官网</a>
                            {selectedModelTemplate.apiKeyUrl && (
                              <a href={selectedModelTemplate.apiKeyUrl} target="_blank" rel="noreferrer" className="ly-mini-action px-2.5 py-1 text-[10px] font-bold">获取 Key</a>
                            )}
                            {selectedModelTemplate.modelsUrl && (
                              <a href={selectedModelTemplate.modelsUrl} target="_blank" rel="noreferrer" className="ly-mini-action px-2.5 py-1 text-[10px] font-bold">模型列表</a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-[1.4rem] border border-white/55 bg-white/45 px-4 py-3.5 shadow-[0_14px_30px_rgba(31,41,55,0.06)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wide"
                          style={currentAvatarStyle}
                        >
                          {currentAvatarLabel}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-[#2f2e33]">模型头像预览</p>
                          <p className="truncate text-[11px] leading-5 text-[var(--muted)]">
                            {modelForm.name.trim() || modelForm.modelName.trim() || selectedModelTemplate?.name || getProviderOptionLabel(modelForm.provider)}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[var(--muted)]">
                        {currentAvatarLabel} · {modelForm.avatarColor}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 border-t border-white/60 pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">头像字母</p>
                          <input
                            value={modelForm.avatarLabel}
                            onChange={(e) =>
                              updateModelForm({
                                avatarLabel: e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 3),
                              })
                            }
                            className="ly-control ly-control-sm font-mono uppercase tracking-[0.18em]"
                            maxLength={3}
                            placeholder={getProviderDefaultAvatarLabel(modelForm.provider)}
                            aria-label="填写模型头像字母"
                          />
                          <p className="text-[11px] text-[var(--muted)]">默认按厂商生成，可改成 1 到 3 个字母。</p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">头像颜色</p>
                          <div className="flex items-center gap-2.5">
                            <label className="relative block h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/60 bg-white/75 shadow-sm shadow-black/5 transition hover:border-white/80 hover:bg-white/85">
                              <span
                                className="absolute inset-[5px] rounded-[0.7rem] border border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                style={{ backgroundColor: modelForm.avatarColor }}
                                aria-hidden="true"
                              />
                              <input
                                type="color"
                                value={modelForm.avatarColor}
                                onChange={(e) => updateModelForm({ avatarColor: e.target.value })}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label="选择模型头像颜色"
                              />
                            </label>
                            <span className="rounded-full border border-white/60 bg-white/65 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[var(--muted)]">
                              {modelForm.avatarColor}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)]">拖动颜色选择器即可实时预览模型头像效果。</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateModelForm({
                              avatarLabel: selectedModelTemplate
                                ? getTemplateAvatarDefaults(selectedModelTemplate, modelForm.provider).avatarLabel
                                : getProviderDefaultAvatarLabel(modelForm.provider),
                            })
                          }
                          className="ly-mini-action px-3 py-2 text-[11px] font-bold"
                        >
                          恢复默认字母
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateModelForm({
                              avatarColor: selectedModelTemplate
                                ? getTemplateAvatarDefaults(selectedModelTemplate, modelForm.provider).avatarColor
                                : getProviderDefaultAvatarColor(modelForm.provider),
                            })
                          }
                          className="ly-mini-action px-3 py-2 text-[11px] font-bold"
                        >
                          恢复默认配色
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── 使用已保存连接（可选折叠区）── */}

                  {connections.length > 0 && !modelForm.id && (
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSavedConnections((v) => !v);
                          if (showSavedConnections && modelForm.connectionId) {
                            updateModelForm({ connectionId: "" });
                            setDiscoveredModels([]);
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/35 bg-white/20 px-3.5 py-2.5 text-left text-[12px] font-bold text-[var(--muted)] transition hover:bg-white/35"
                      >
                        <span>
                          {selectedConnection
                            ? `已使用连接：${selectedConnection.name}`
                            : "使用已保存连接（可选）"}
                        </span>
                        <span className="ml-2 text-[10px] opacity-60">{showSavedConnections ? "收起 ▲" : "展开 ▼"}</span>
                      </button>
                      {showSavedConnections && (
                        <div className="mt-2 space-y-1.5">
                          <select
                            value={modelForm.connectionId}
                            onChange={(e) => selectSavedConnectionForModel(e.target.value)}
                            className="ly-control ly-glass-select appearance-none"
                          >
                            <option value="">不使用，直接填写连接参数</option>
                            {connections.map((connection) => (
                              <option key={connection.id} value={connection.id}>
                                {connection.name} · {getProviderChineseLabel(connection.provider)}
                              </option>
                            ))}
                          </select>
                          {selectedConnection && (
                            <div className="ly-inline-panel flex items-start gap-3 px-3.5 py-3">
                              <span
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-wide shadow-sm"
                                style={getAvatarPreviewStyle(
                                  selectedConnection.provider,
                                  selectedSavedConnectionAvatar?.avatarColor ?? getProviderDefaultAvatarColor(selectedConnection.provider),
                                )}
                              >
                                {selectedSavedConnectionAvatar?.avatarLabel ?? getProviderDefaultAvatarLabel(selectedConnection.provider)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#2f2e33]">{selectedConnection.name}</p>
                                <p className="mt-0.5 break-all font-mono text-[11px] leading-5 text-[var(--muted)]">{selectedConnection.baseUrl}</p>
                                <p className="mt-1 text-[11px] text-[var(--muted)]">Provider、Base URL 和 API Key 将继承自此连接，只需补模型 ID。</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Base URL（无连接时显示）*/}
                  {!selectedConnection && (
                    <div className="space-y-1.5">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Base URL</label>
                      <input
                        value={modelForm.baseUrl}
                        onChange={(e) => updateModelForm({ baseUrl: e.target.value })}
                        aria-invalid={Boolean(modelFieldErrors.baseUrl)}
                        className={`ly-control font-mono text-[12px] ${getInputErrorClass(modelFieldErrors.baseUrl)}`}
                      />
                      <FieldErrorHint message={modelFieldErrors.baseUrl} />
                    </div>
                  )}



                  {/* API Key（无连接时显示）*/}
                  {!selectedConnection && (
                    <div className="space-y-1.5">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">API Key</label>
                      <input
                        value={modelForm.apiKey}
                        onChange={(e) => updateModelForm({ apiKey: e.target.value })}
                        type="password"
                        aria-invalid={Boolean(modelFieldErrors.apiKey)}
                        className={`ly-control font-mono text-[12px] tracking-widest placeholder:tracking-normal ${getInputErrorClass(modelFieldErrors.apiKey)}`}
                        placeholder={modelForm.id ? "••••••••••••••••" : "输入 API Key"}
                      />
                      <FieldErrorHint message={modelFieldErrors.apiKey} />
                    </div>
                  )}

                  {/* 获取模型列表 + 模型 ID */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        模型 ID
                        {discoverySupported && (
                          <span className="ml-2 text-[10px] normal-case text-[var(--accent)]">支持自动获取</span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void handleDiscoverModels())}
                        disabled={
                          !discoverySupported ||
                          (!modelForm.connectionId && (!modelForm.baseUrl.trim() || (!modelForm.apiKey.trim() && !modelForm.id))) ||
                          Boolean(activeAction)
                        }


                        className="shrink-0 ly-secondary-action rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold shadow-sm border-black/5 disabled:opacity-40"
                      >
                        {activeAction === "discovering" ? "获取中..." : "获取列表"}
                      </button>
                    </div>

                    {discoveredModels.length > 0 ? (
                      <div ref={discoveredModelMenuRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setShowDiscoveredModelMenu((current) => !current)}
                          className={`ly-select-shell flex min-h-[2.625rem] items-center justify-between gap-3 px-3.5 text-left transition-all duration-200 ${
                            showDiscoveredModelMenu
                              ? "border-[color:color-mix(in_srgb,var(--accent)_28%,white_72%)] bg-white/75 shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent_90%),0_16px_34px_rgba(220,117,165,0.12)]"
                              : "hover:bg-white/55 hover:shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
                          }`}
                          aria-haspopup="listbox"
                          aria-expanded={showDiscoveredModelMenu}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#2f2e33]">
                              {selectedDiscoveredModel?.label ?? "请从列表中选择一个模型"}
                            </p>
                            <p className="truncate font-mono text-[10px] leading-5 text-[var(--muted)]">
                              {selectedDiscoveredModel?.id ?? `已获取 ${discoveredModels.length} 个可用模型`}
                            </p>
                          </div>
                          <span
                            className="shrink-0 text-[var(--muted)]/75 transition-transform duration-200"
                            style={{ transform: showDiscoveredModelMenu ? "rotate(180deg)" : "rotate(0deg)" }}
                          >
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                        {showDiscoveredModelMenu && (
                          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[1.2rem] border border-white/60 bg-[rgba(255,255,255,0.78)] shadow-[0_24px_60px_rgba(31,41,55,0.14)] backdrop-blur-[26px]">
                            <div className="max-h-72 overflow-y-auto p-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDiscoveredModelMenu(false);
                                  updateModelForm({ modelName: "" });
                                }}
                                className={getGlassMenuOptionClassName(!selectedDiscoveredModel)}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-bold text-[#2f2e33]">请从列表中选择一个模型</p>
                                  <p className="truncate text-[10px] leading-5 text-[var(--muted)]">也可以继续手动填写模型 ID</p>
                                </div>
                                <MenuCheck visible={!selectedDiscoveredModel} />
                              </button>
                              {discoveredModels.map((item) => {
                                const isActive = item.id === modelForm.modelName;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      updateModelForm({ modelName: item.id });
                                      setShowDiscoveredModelMenu(false);
                                    }}
                                    className={getGlassMenuOptionClassName(isActive)}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[12px] font-bold text-[#2f2e33]">{item.label}</p>
                                      <p className="truncate font-mono text-[10px] leading-5 text-[var(--muted)]">{item.id}</p>
                                    </div>
                                    <MenuCheck visible={isActive} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      !discoverySupported && (
                        <p className="ml-1 text-[11px] leading-5 text-[var(--muted)]">
                          当前平台不支持自动获取，请手动填写模型 ID。
                        </p>
                      )
                    )}

                    <input
                      value={modelForm.modelName}
                      onChange={(e) => updateModelForm({ modelName: e.target.value })}
                      aria-invalid={Boolean(modelFieldErrors.modelName)}
                      className={`ly-control font-mono text-[12px] ${getInputErrorClass(modelFieldErrors.modelName)}`}
                      placeholder={
                        selectedConnection
                          ? "填写或从列表选择模型 ID"
                          : selectedPreset.defaultModelName || "填写模型 ID（如 gpt-4o）"
                      }
                    />
                    <FieldErrorHint message={modelFieldErrors.modelName} />
                    {modelDiscoveryFeedback ? <FeedbackPanel feedback={modelDiscoveryFeedback} /> : null}
                  </div>

                  {/* 回复字数 */}
                  <div className="space-y-1.5">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">回复字数上限</label>
                    <input
                      type="number"
                      min={50}
                      max={4000}
                      step={10}
                      value={modelForm.defaultReplyLength}
                      onChange={(e) =>
                        updateModelForm({
                          defaultReplyLength: Number.parseInt(e.target.value, 10) || modelForm.defaultReplyLength,
                        })
                      }
                      className="ly-control"
                    />
                  </div>

                  {/* 启用复选框 */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/30 bg-white/20 px-4 py-3 transition hover:bg-white/20 backdrop-blur-lg">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="peer sr-opacity absolute h-5 w-5 opacity-0"
                        checked={modelForm.enabled}
                        onChange={(e) => updateModelForm({ enabled: e.target.checked })}
                      />
                      <div className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-[var(--muted)]/30 bg-white/30 transition-all peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)]">
                        <svg
                          className={`h-3 w-3 text-white transition-transform duration-300 ${modelForm.enabled ? "scale-100" : "scale-0"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-[13px] font-bold">创建后立即启用</span>
                  </label>

                  {/* 提交 */}
                  {modelSubmitFeedback ? <FeedbackPanel feedback={modelSubmitFeedback} /> : null}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => startTransition(() => void submitModelForm())}
                      disabled={Boolean(activeAction)}
                      className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {modelForm.id
                        ? (activeAction === "updating" ? "保存中..." : "保存修改")
                        : (activeAction === "creating" ? "创建中..." : "创建模型")}
                    </button>
                    {modelForm.id ? (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="ly-secondary-action px-5 py-3 text-[14px] font-bold active:scale-95"
                      >
                        取消
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* ══ 管理已保存连接（可选面板）══ */}
            {builderMode === "connection" && (
              <div ref={connectionFormPanelRef} className="ly-glass ly-panel-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-display font-bold tracking-tight">
                      {connectionForm.id ? "编辑连接" : "保存 Provider 连接"}
                    </h2>
                    <p className="mt-0.5 text-[12px] leading-6 text-[var(--muted)]">
                      保存后可在建模型时快速复用，适合同一 Key 下多个模型。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { switchBuilderMode("model"); resetConnectionForm(); }}
                    className="shrink-0 ly-mini-action px-3 py-1.5 text-[11px] font-bold"
                  >
                    ← 返回建模型
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">连接名称</label>
                    <input
                      value={connectionForm.name}
                      onChange={(e) => updateConnectionForm({ name: e.target.value })}
                      className="ly-control"
                      placeholder="例如：豆包正式环境 / 个人 OpenAI"
                    />
                  </div>

                  {/* 平台模板快选 */}
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">厂商 / 平台</label>
                    <select
                      value={connectionProviderChoiceValue}
                      onChange={(e) => handleConnectionProviderChoice(e.target.value)}
                      className="ly-control ly-glass-select appearance-none"
                    >
                      <optgroup label="国内常用">
                        {groupedConnectionTemplates.domestic.map((template) => (
                          <option key={template.id} value={`template:${template.id}`}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="海外常用">
                        {groupedConnectionTemplates.global.map((template) => (
                          <option key={template.id} value={`template:${template.id}`}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="自定义接入">
                        {customProviderChoices.map((provider) => (
                          <option key={provider} value={`provider:${provider}`}>
                            {getProviderOptionLabel(provider)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <div className="ly-inline-panel mt-2 flex items-start gap-3 px-3.5 py-3">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm"
                        style={getAvatarPreviewStyle(connectionForm.provider, connectionFormAvatar.avatarColor)}
                      >
                        {connectionFormAvatar.avatarLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13px] font-bold text-[#2f2e33]">
                            {selectedConnectionTemplate?.name ?? getProviderOptionLabel(connectionForm.provider)}
                          </p>
                          <span className="rounded-full border border-[var(--accent)]/15 bg-[var(--accent)]/8 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                            {connectionDiscoverySupported ? "可测试并获取列表" : "建议手动模型 ID"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
                          {selectedConnectionTemplate?.subtitle ?? "自定义接入模式，适合同一 Key 下保存多个模型连接。"}
                        </p>
                        {selectedConnectionTemplate && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <a href={selectedConnectionTemplate.officialUrl} target="_blank" rel="noreferrer" className="ly-mini-action px-2.5 py-1 text-[10px] font-bold">官网</a>
                            {selectedConnectionTemplate.apiKeyUrl && (
                              <a href={selectedConnectionTemplate.apiKeyUrl} target="_blank" rel="noreferrer" className="ly-mini-action px-2.5 py-1 text-[10px] font-bold">获取 Key</a>
                            )}
                            {selectedConnectionTemplate.modelsUrl && (
                              <a href={selectedConnectionTemplate.modelsUrl} target="_blank" rel="noreferrer" className="ly-mini-action px-2.5 py-1 text-[10px] font-bold">模型列表</a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Base URL</label>
                    <input
                      value={connectionForm.baseUrl}
                      onChange={(e) => updateConnectionForm({ baseUrl: e.target.value })}
                      aria-invalid={Boolean(connectionFieldErrors.baseUrl)}
                      className={`ly-control font-mono text-[12px] ${getInputErrorClass(connectionFieldErrors.baseUrl)}`}
                    />
                    <FieldErrorHint message={connectionFieldErrors.baseUrl} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">API Key</label>
                    <input
                      value={connectionForm.apiKey}
                      onChange={(e) => updateConnectionForm({ apiKey: e.target.value })}
                      type="password"
                      aria-invalid={Boolean(connectionFieldErrors.apiKey)}
                      className={`ly-control font-mono text-[12px] tracking-widest placeholder:tracking-normal ${getInputErrorClass(connectionFieldErrors.apiKey)}`}
                      placeholder={connectionForm.id ? "留空代表保留当前 Key" : "输入 API Key"}
                    />
                    <FieldErrorHint message={connectionFieldErrors.apiKey} />
                  </div>

                  {!connectionDiscoverySupported && (
                    <div className="space-y-1.5">
                      <label className="ml-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">测试用模型 ID</label>
                      <input
                        value={connectionForm.probeModelName}
                        onChange={(e) => updateConnectionForm({ probeModelName: e.target.value })}
                        aria-invalid={Boolean(connectionFieldErrors.probeModelName)}
                        className={`ly-control font-mono text-[12px] ${getInputErrorClass(connectionFieldErrors.probeModelName)}`}
                        placeholder={getProviderPreset(connectionForm.provider).defaultModelName || "填写一个可用模型 ID 用于测试连接"}
                      />
                      <FieldErrorHint message={connectionFieldErrors.probeModelName} />
                    </div>
                  )}

                  {connectionFormFeedback ? <FeedbackPanel feedback={connectionFormFeedback} /> : null}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => startTransition(() => void submitConnectionForm())}
                      disabled={Boolean(activeAction)}
                      className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {connectionForm.id ? "保存连接" : "创建连接"}
                    </button>
                    {connectionForm.id && (
                      <button
                        type="button"
                        onClick={resetConnectionForm}
                        className="ly-secondary-action px-5 py-3 text-[14px] font-bold active:scale-95"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>

                {/* 已保存连接列表 */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">已保存的连接</p>
                    <span className="rounded-full border border-white/40 bg-white/30 px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">{connections.length}</span>
                  </div>
                  {connections.length === 0 ? (
                    <div className="ly-empty-card px-4 py-4 text-[12px] text-[var(--muted)]">
                      还没有保存过连接。上方填写后点“创建连接”即可。
                    </div>
                  ) : (
                    connections.map((connection) => {
                      const discoveredFromConnection = connectionDiscoveredModels[connection.id] ?? [];
                      const matchedTemplate = findTemplateByProviderAndBaseUrl(connection.provider, connection.baseUrl);
                      return (
                        <div key={connection.id} className="ly-inline-panel space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-bold text-[#2f2e33]">{connection.name}</p>
                                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getProviderBadgeClassName(connection.provider)}`}>
                                  {getProviderChineseLabel(connection.provider)}
                                </span>
                                {matchedTemplate && (
                                  <span className="rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                                    {matchedTemplate.name}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 break-all font-mono text-[11px] leading-5 text-[var(--muted)]">
                                {connection.baseUrl}
                              </p>
                            </div>
                            <div className="shrink-0 text-right text-[11px] text-[var(--muted)]">
                              <p>{connection.modelCount} 个模型</p>
                              {connection.lastAuthCheck && (
                                <span className={`mt-1 block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${connection.lastAuthCheck.status === "success" ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700" : "border-red-200/50 bg-red-50/80 text-red-600"}`}>
                                  {connection.lastAuthCheck.status === "success" ? "连接成功" : "连接失败"}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => startEditingConnection(connection)} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95">编辑</button>
                            <button type="button" onClick={() => attachConnectionToModel(connection)} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95">用它建模</button>
                            <button type="button" onClick={() => startTransition(() => void testConnection(connection))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95">
                              {runningTestConnectionId === connection.id ? "测试中" : "测试连接"}
                            </button>
                            {connection.supportsAutomaticModelDiscovery && (
                              <button type="button" onClick={() => startTransition(() => void discoverConnectionModels(connection))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold active:scale-95">
                                获取模型
                              </button>
                            )}
                            <button type="button" onClick={() => startTransition(() => void removeConnection(connection))} className="ly-mini-action border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white active:scale-95">删除</button>
                          </div>

                          {discoveredFromConnection.length > 0 && (
                            <div className="rounded-xl border border-white/35 bg-white/30 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">已发现的模型</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {discoveredFromConnection.slice(0, 8).map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => attachConnectionToModel(connection, item.id)}
                                    className="rounded-lg border border-white/50 bg-white/70 px-2.5 py-1.5 text-left text-[11px] font-medium text-[#2f2e33] transition hover:border-[var(--accent)]/30 hover:bg-white"
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─ Model list ─ */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索模型名称、ID 或接入地址..." className="flex-1 rounded-xl border border-white/40 bg-white/20 px-4 py-2.5 text-[13px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-lg" />
            <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as ProviderType | "ALL")} className="ly-glass-select rounded-xl border border-white/40 bg-white/20 px-3 py-2.5 text-[13px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-lg appearance-none">
              <option value="ALL">全部提供商</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>{getProviderOptionLabel(provider)}</option>
              ))}
            </select>
            {filteredModels.length !== models.length && (
              <span className="text-[12px] font-medium text-[var(--accent)]">匹配 {filteredModels.length} 个</span>
            )}
          </div>

          {/* Cards */}
          {models.length === 0 ? (
            <div className="ly-empty-card grid gap-5 px-6 py-8 text-left lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">Model Hub</p>
                <h3 className="text-2xl font-display font-bold tracking-tight text-[#2f2e33]">
                  先把模型入口准备好，再开始搭建协作房间
                </h3>
                <p className="max-w-2xl text-[14px] leading-7 text-[var(--muted)]">
                  从左侧选择提供商或平台模板，填入 Base URL 和 API Key，再补上模型 ID，就能创建一个模型接入。
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="button" onClick={fillLocalMockPreset} className="ly-secondary-action rounded-xl px-4 py-2.5 text-[13px] font-bold">
                    载入测试预设
                  </button>
                  {mockToolsEnabled && (
                    <button type="button" onClick={() => startTransition(() => void createLocalMocks())} className="ly-primary-action rounded-xl px-4 py-2.5 text-[13px] font-bold">
                      生成本地 Mock 模型
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  "选择提供商或平台模板，Base URL 自动带出。",
                  "填入 API Key，点击「获取列表」或手动填写模型 ID。",
                  "点击「创建模型」，然后去新建房间开聊。",
                ].map((item, index) => (
                  <div key={item} className="rounded-[1.35rem] bg-white/45 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">步骤 {index + 1}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="ly-empty-card px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)]">
              没有匹配模型，试试清空关键词或切换 Provider。
            </div>
          ) : (
            filteredModels.map((model) => {
              const testStatus = model.lastConnectionTest?.status;
              const isSuccess = testStatus === "success";
              const isFailed = testStatus === "error";
              const isUntested = !model.lastConnectionTest;
              const modelInsight = getModelOperationalInsight(model);
              const resolvedAvatar = resolveModelAvatar(model.provider, model.baseUrl, model.avatarLabel, model.avatarColor);


              let cardClass = "ly-panel-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ";
              let stripeClass = "";
              let dotClass = "";

              if (!model.enabled) {
                cardClass += "border border-dashed border-stone-300/80 bg-stone-100/60 opacity-60 grayscale hover:opacity-100 hover:grayscale-0";
                stripeClass = "bg-stone-400";
                dotClass = "bg-stone-400";
              } else if (isFailed) {
                cardClass += "ly-glass border-red-300 bg-red-50/30";
                stripeClass = "bg-red-500";
                dotClass = "bg-red-500 animate-pulse";
              } else if (isUntested) {
                cardClass += "ly-glass";
                stripeClass = "bg-amber-400";
                dotClass = "bg-amber-400";
              } else if (isSuccess) {
                cardClass += "ly-glass border-emerald-300/50";
                stripeClass = "bg-emerald-500";
                dotClass = "bg-emerald-500";
              } else {
                cardClass += "ly-glass";
                stripeClass = "bg-stone-300";
                dotClass = "bg-stone-400";
              }

              return (
              <article key={model.id} className={`${cardClass} min-w-0`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-[inherit] ${stripeClass}`} />

                <div className="flex items-start gap-4 pl-2">
                  <div className="relative shrink-0">
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide shadow-md transition-transform duration-300 group-hover:scale-105"
                      style={getAvatarPreviewStyle(model.provider, resolvedAvatar.avatarColor)}
                    >
                      {resolvedAvatar.avatarLabel}
                    </span>

                    <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white ${dotClass}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-display font-bold tracking-tight">{model.name}</h3>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${model.enabled ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700" : "border-stone-300 bg-stone-100 text-stone-500"}`}>
                        {model.enabled ? "已启用" : "已停用"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${getProviderBadgeClassName(model.provider)}`}>{getProviderChineseLabel(model.provider)}</span>
                      <span className="rounded-md border border-white/60 bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)} 上限</span>
                      <TestState state={model.lastConnectionTest} running={runningTestModelId === model.id} />
                      {modelInsight && (
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                            modelInsight.tone === "warning"
                              ? "border-amber-300/60 bg-amber-50/80 text-amber-700"
                              : "border-red-300/60 bg-red-50/80 text-red-600"
                          }`}
                        >
                          {modelInsight.shortLabel}
                        </span>
                      )}
                    </div>

                  </div>
                </div>

                <div className="ly-inline-panel mt-3 ml-2 grid gap-3 px-3.5 py-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider">模型 ID</p>
                    <p className="mt-0.5 break-all font-mono text-[12px] font-bold">{model.modelName || "未填写"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider">Base URL</p>
                    <p className="mt-0.5 break-all font-mono text-[11px] font-bold leading-relaxed">{model.baseUrl}</p>
                  </div>
                </div>

                {modelInsight ? <ModelInsightNotice insight={modelInsight} /> : null}

                <div className="mt-2 ml-2 flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)] opacity-60">
                    {model.lastConnectionTest
                      ? `测试于 ${formatDate(model.lastConnectionTest.testedAt)} — ${formatModelTestMessage(model.lastConnectionTest)}`
                      : `更新于 ${formatDate(model.updatedAt)}`}
                  </p>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:justify-end">

                    <button
                      type="button"
                      onClick={() => {
                        setBuilderMode("model");
                        setShowSavedConnections(Boolean(model.connectionId));
                        setSelectedModelTemplateId(findTemplateByProviderAndBaseUrl(model.provider, model.baseUrl)?.id ?? "");
                        setModelForm({
                          id: model.id,
                          connectionId: model.connectionId ?? "",
                          name: model.name,
                          provider: model.provider,
                          baseUrl: model.baseUrl,
                          modelName: model.modelName,
                          avatarLabel: model.avatarLabel,
                          avatarColor: model.avatarColor,
                          apiKey: "",
                          defaultReplyLength: model.defaultReplyLength,
                          enabled: model.enabled,
                        });

                        setDiscoveredModels(model.connectionId ? connectionDiscoveredModels[model.connectionId] ?? [] : []);
                        setNotice(`正在编辑模型「${model.name}」。`);
                      }}
                      className="ly-mini-action px-3 py-1.5 text-[11px] font-bold hover:text-[var(--accent)] active:scale-95"
                    >
                      编辑
                    </button>
                    <button type="button" onClick={() => startTransition(() => void testModel(model))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold hover:text-sky-600 active:scale-95">{runningTestModelId === model.id ? "测试中" : "测试"}</button>
                    <button type="button" onClick={() => startTransition(() => void toggleModel(model))} className="ly-mini-action px-3 py-1.5 text-[11px] font-bold hover:text-[var(--accent)] active:scale-95">{model.enabled ? "停用" : "启用"}</button>
                    <button type="button" onClick={() => startTransition(() => void removeModel(model))} className="ly-mini-action border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white active:scale-95">删除</button>
                  </div>
                </div>
              </article>
              );
            })
          )}
        </div>
      </section>
      </div>
    </main>
  );
}
