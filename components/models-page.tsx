"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { ChatSectionNav } from "@/components/chat-section-nav";
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
  getDirectCreateProviderOptions,
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
} from "@/lib/client/longyuchat-client";
import {
  getProviderDefaultAvatarColor,
} from "@/lib/model-avatar";
import {
  getAvatarLabelPreview,
  getAvatarPreviewStyle,
  useModelBuilderState,
} from "@/components/models-page/model-builder";
import {
  useConnectionBuilderState,
} from "@/components/models-page/connection-builder";
import {
  resolveConnectionFieldErrors,
  resolveModelFieldErrors,
  type ConnectionFormFieldKey,
  type ModelFormFieldKey,
} from "@/components/models-page/error-field-resolver";
import {
  FeedbackPanel,
} from "@/components/models-page/shared-ui";
import { ProviderConnectionPanel } from "@/components/models-page/provider-connection-panel";
import { ModelBuilderPanel } from "@/components/models-page/model-builder-panel";
import { ModelListPanel } from "@/components/models-page/model-list-panel";


import type {
  CreateProviderConnectionPayload,
  DiscoveredModelView,
  ModelView,
  ProviderConnectionTemplateView,
  ProviderConnectionView,
  ProviderType,
} from "@/types/app";
const directCreateProviderChoices = getDirectCreateProviderOptions();

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
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderType | "ALL">("ALL");
  const [runningTestModelId, setRunningTestModelId] = useState<string | null>(null);
  const [runningTestConnectionId, setRunningTestConnectionId] = useState<string | null>(null);
  const [connectionDiscoveredModels, setConnectionDiscoveredModels] = useState<
    Record<string, DiscoveredModelView[]>
  >({});
  const [showModelProviderMenu, setShowModelProviderMenu] = useState(false);
  const modelProviderMenuRef = useRef<HTMLDivElement | null>(null);
  const [showDiscoveredModelMenu, setShowDiscoveredModelMenu] = useState(false);
  const discoveredModelMenuRef = useRef<HTMLDivElement | null>(null);
  const modelFormPanelRef = useRef<HTMLDivElement | null>(null);
  const connectionFormPanelRef = useRef<HTMLDivElement | null>(null);
  const {
    modelSourceMode,
    editingInitialConnectionId,
    modelForm,
    discoveredModels,
    selectedConnection,
    selectedModelTemplate,
    selectedSavedConnectionAvatar,
    selectedDiscoveredModel,
    usingSavedConnection,
    updateModelForm,
    replaceModelForm,
    setDiscoveredModels,
    switchModelSourceMode,
    resetForm,
    updateProvider,
    applyModelTemplate,
    attachConnectionToModel,
    selectSavedConnectionForModel,
    startEditingModel,
  } = useModelBuilderState({
    connections,
    connectionTemplates,
    connectionDiscoveredModels,
    clearInlineFeedback: () => {
      setModelSubmitFeedback(null);
      setModelDiscoveryFeedback(null);
      setModelFieldErrors({});
    },
  });
  const {
    connectionForm,
    selectedConnectionTemplate,
    connectionProviderChoiceValue,
    connectionDiscoverySupported,
    connectionFormAvatar,
    updateConnectionForm,
    resetConnectionForm,
    handleConnectionProviderChoice: applyConnectionProviderChoice,
    startEditingConnection: beginEditingConnection,
    resolveConnectionProbeModelName,
  } = useConnectionBuilderState({
    connectionTemplates,
    clearInlineFeedback: () => {
      setConnectionFormFeedback(null);
      setConnectionFieldErrors({});
    },
  });

  const groupedConnectionTemplates = useMemo(
    () => ({
      domestic: connectionTemplates.filter((template) => template.category === "DOMESTIC"),
      global: connectionTemplates.filter((template) => template.category === "GLOBAL"),
    }),
    [connectionTemplates],
  );

  // 当前表单对应的 discovery 能力

  const discoverySupported = usingSavedConnection
    ? Boolean(selectedConnection?.supportsAutomaticModelDiscovery)
    : selectedModelTemplate
      ? selectedModelTemplate.preferredDiscoveryStrategy !== "MANUAL_ONLY"
      : supportsAutomaticModelDiscovery(modelForm.provider);

  const selectedPreset = getProviderPreset(modelForm.provider);
  const currentAvatarStyle = getAvatarPreviewStyle(modelForm.provider, modelForm.avatarColor);
  const currentAvatarLabel = getAvatarLabelPreview(modelForm.avatarLabel, modelForm.provider);
  const selectedModelChoiceLabel = selectedModelTemplate?.name ?? getProviderOptionLabel(modelForm.provider);
  const selectedModelChoiceSubtitle =
    selectedModelTemplate?.subtitle ?? "自定义接入模式，可手动填写 Base URL、API Key 和模型 ID。";

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

  function handleModelProviderChoice(nextValue: string) {
    if (nextValue.startsWith("template:")) {
      const template = applyModelTemplate(nextValue.slice("template:".length));
      if (template) {
        setNotice(`已套用「${template.name}」模板。`);
        setFeedback(null);
      }
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
      setConnectionFormFeedback(null);
      setConnectionFieldErrors({});
    } else {
      clearModelInlineFeedback();
    }
  }

  function handleConnectionProviderChoice(nextValue: string) {
    const selection = applyConnectionProviderChoice(nextValue);

    if (selection.template) {
      setNotice(`已套用「${selection.template.name}」模板。`);
      setFeedback(null);
    }
  }


  async function submitModelForm() {
    setActiveAction(modelForm.id ? "updating" : "creating");
    setFeedback(null);
    clearModelInlineFeedback();
    try {
      if (usingSavedConnection && !modelForm.connectionId) {
        const nextFeedback = {
          title: "请先选择一个已保存连接",
          description: "当前已切换到“使用已保存连接”模式，但还没有选择具体连接。",
          suggestion: "先从已保存连接列表里选中一个连接；如果你想手动填写参数，请切回“直接配置”。",
          tone: "warning",
        } satisfies ClientErrorFeedback;
        setModelSubmitFeedback(nextFeedback);
        return;
      }

      const derivedModelName = modelForm.modelName.trim();
      const derivedDisplayName =
        modelForm.name.trim() ||
        derivedModelName ||
        selectedModelTemplate?.name ||
        getProviderChineseLabel(modelForm.provider);
      const shouldDetachConnection =
        modelForm.id && modelSourceMode === "direct" && Boolean(editingInitialConnectionId);
      const payload = {
        name: derivedDisplayName,
        modelName: derivedModelName,
        ...(modelForm.avatarLabel.trim() ? { avatarLabel: modelForm.avatarLabel.trim() } : {}),
        avatarColor: modelForm.avatarColor,
        defaultReplyLength: modelForm.defaultReplyLength,
        enabled: modelForm.enabled,
        ...(usingSavedConnection
          ? { connectionId: modelForm.connectionId }
          : {
              ...(shouldDetachConnection ? { connectionId: null } : {}),
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

      if (!usingSavedConnection && modelForm.apiKey.trim()) {
        try {
          await fetchJson(`/api/models/${result.model.id}/test`, { method: "POST", body: JSON.stringify({}) });
          await loadModels();
          setNotice(createSavedNotice("模型", modelForm.id ? "更新" : "创建", derivedDisplayName, true));
        } catch (error: unknown) {
          await loadModels();
          setNotice(createSavedNotice("模型", modelForm.id ? "更新" : "创建", derivedDisplayName, false));
          const nextFeedback = createSavedVerificationFeedback("模型", derivedDisplayName, error);
          setModelSubmitFeedback(nextFeedback);
          setModelFieldErrors(resolveModelFieldErrors(error, nextFeedback, "submit"));
        }
      } else {
        setNotice(createPlainSavedNotice("模型", modelForm.id ? "更新" : "创建", derivedDisplayName));
      }
    } catch (error: unknown) {
      const nextFeedback = describeClientError(error);
      setModelSubmitFeedback(nextFeedback);
      setModelFieldErrors(resolveModelFieldErrors(error, nextFeedback, "submit"));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDiscoverModels() {
    if (usingSavedConnection && !modelForm.connectionId) {
      const nextFeedback = {
        title: "请先选择一个已保存连接",
        description: "当前已切换到“使用已保存连接”模式，但还没有选择具体连接。",
        suggestion: "先从连接列表里选中一个连接；如果你想手动填写参数，请切回“直接配置”。",
        tone: "warning",
      } satisfies ClientErrorFeedback;
      setModelDiscoveryFeedback(nextFeedback);
      return;
    }

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
        setModelFieldErrors(resolveModelFieldErrors(error, nextFeedback, "discover"));
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
        setModelFieldErrors(resolveModelFieldErrors(error, nextFeedback, "discover"));
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
      setModelFieldErrors(resolveModelFieldErrors(undefined, nextFeedback, "discover"));
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
      setModelFieldErrors(resolveModelFieldErrors(error, nextFeedback, "discover"));
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
    replaceModelForm(
      {
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
      },
      {
        sourceMode: "direct",
        discoveredModels: [
          { id: "mock-alpha", label: "mock-alpha", description: "local-mock" },
          { id: "mock-beta", label: "mock-beta", description: "local-mock" },
          { id: "mock-gamma", label: "mock-gamma", description: "local-mock" },
        ],
      },
    );
    setNotice("已填入本地测试模型参数。");
    setFeedback(null);
  }

  async function submitConnectionForm() {
    setActiveAction(connectionForm.id ? "connection-updating" : "connection-creating");
    setFeedback(null);
    setConnectionFormFeedback(null);
    setConnectionFieldErrors({});
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
          const probeModelName = resolveConnectionProbeModelName(
            result.connection,
            connectionForm.probeModelName,
          );
          await testProviderConnectionRequest(result.connection.id, {
            modelName: probeModelName,
          });
          await loadConnections();
          setNotice(createSavedNotice("连接", connectionForm.id ? "更新" : "创建", connectionForm.name, true));
        } catch (error: unknown) {
          await loadConnections();
          setNotice(createSavedNotice("连接", connectionForm.id ? "更新" : "创建", connectionForm.name, false));
          const nextFeedback = createSavedVerificationFeedback("连接", connectionForm.name, error);
          setConnectionFormFeedback(nextFeedback);
          setConnectionFieldErrors(resolveConnectionFieldErrors(error, nextFeedback));
        }
      } else if (connectionForm.id) {
        setNotice(createPlainSavedNotice("连接", "更新", connectionForm.name));
      } else {
        setNotice(`已创建连接「${connectionForm.name}」，可在“使用已保存连接”中选择复用。`);
      }
    } catch (error: unknown) {
      const nextFeedback = describeClientError(error);
      setConnectionFormFeedback(nextFeedback);
      setConnectionFieldErrors(resolveConnectionFieldErrors(error, nextFeedback));
    } finally {
      setActiveAction(null);
    }
  }

  async function testConnection(connection: ProviderConnectionView) {
    setActiveAction("connection-testing");
    setRunningTestConnectionId(connection.id);
    setFeedback(null);
    try {
      const probeModelName = resolveConnectionProbeModelName(
        connection,
        connectionForm.id === connection.id ? connectionForm.probeModelName : undefined,
      );
      await testProviderConnectionRequest(connection.id, {
        modelName: probeModelName,
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
        switchModelSourceMode("direct");
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
    beginEditingConnection(connection);
    setNotice(`正在编辑连接「${connection.name}」。`);
    setFeedback(null);
  }

  if (activeAction === "loading" && models.length === 0) {

    return (
      <main className="ly-page-wrap ly-page-chat">
        <div className="ly-shell page-rise flex flex-col gap-5">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
            <div className="ly-glass flex h-full rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
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

            <div className="ly-surface-card grid gap-4 rounded-[1.75rem] p-5 sm:grid-cols-3 sm:p-6">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-[1.4rem] bg-white/45 px-4 py-4">
                  <div className="h-3 w-20 animate-pulse rounded bg-white/50" />
                  <div className="mt-3 h-8 w-14 animate-pulse rounded bg-white/55" />
                  <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/40" />
                </div>
              ))}
            </div>
          </section>

          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
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
    <main className="ly-page-wrap ly-page-chat">
      <div className="ly-shell page-rise flex flex-col gap-5">
      {/* ─ Page header ─ */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
        <div className="ly-glass flex h-full rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          <div className="ly-chat-domain-header w-full">
            <div className="ly-chat-domain-top">
              <div className="ly-page-heading">
                <h1 className="ly-page-title">模型管理</h1>
                <p className="ly-page-subtitle">
                  共 {models.length} 个模型 · 配置、测试并管理你的多模型入口
                </p>
              </div>
              <ChatSectionNav />
            </div>
            <div className="ly-chat-domain-tools">
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

        <div className="ly-surface-card grid h-full gap-4 rounded-[1.75rem] p-5 sm:grid-cols-3 sm:p-6">
          <div className="flex min-h-full flex-col justify-center rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">已启用</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#0F1A2B]">{modelStats.enabledCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">已可参与房间协作的模型数量。</p>
          </div>
          <div className="flex min-h-full flex-col justify-center rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">连接正常</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#0F1A2B]">{modelStats.testedSuccessCount}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">最近连接测试成功的模型数量。</p>
          </div>
          <div className="flex min-h-full flex-col justify-center rounded-[1.4rem] bg-white/45 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">Provider</p>
            <p className="mt-2 text-3xl font-display font-bold tracking-tight text-[#0F1A2B]">{modelStats.providerCount}</p>
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
      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <div className="flex min-w-0 flex-col gap-5">

            {/* ══ 直接建模型（主流程）══ */}
            {builderMode === "model" && (
              <ModelBuilderPanel
                panelRef={modelFormPanelRef}
                modelProviderMenuRef={modelProviderMenuRef}
                discoveredModelMenuRef={discoveredModelMenuRef}
                modelForm={modelForm}
                modelSourceMode={modelSourceMode}
                selectedModelTemplate={selectedModelTemplate}
                selectedConnection={selectedConnection}
                selectedSavedConnectionAvatar={selectedSavedConnectionAvatar}
                selectedDiscoveredModel={selectedDiscoveredModel}
                discoveredModels={discoveredModels}
                connections={connections}
                groupedConnectionTemplates={groupedConnectionTemplates}
                directCreateProviderChoices={directCreateProviderChoices}
                currentAvatarStyle={currentAvatarStyle}
                currentAvatarLabel={currentAvatarLabel}
                selectedModelChoiceLabel={selectedModelChoiceLabel}
                selectedModelChoiceSubtitle={selectedModelChoiceSubtitle}
                selectedPresetDefaultModelName={selectedPreset.defaultModelName}
                discoverySupported={discoverySupported}
                modelFieldErrors={modelFieldErrors}
                modelSubmitFeedback={modelSubmitFeedback}
                modelDiscoveryFeedback={modelDiscoveryFeedback}
                activeAction={activeAction}
                showModelProviderMenu={showModelProviderMenu}
                showDiscoveredModelMenu={showDiscoveredModelMenu}
                onOpenConnectionManager={() => switchBuilderMode("connection")}
                onSwitchModelSourceMode={switchModelSourceMode}
                onToggleModelProviderMenu={() => setShowModelProviderMenu((current) => !current)}
                onChooseModelProviderOption={handleModelProviderChoice}
                onUpdateModelForm={updateModelForm}
                onSelectSavedConnection={(connectionId) => {
                  const connection = selectSavedConnectionForModel(connectionId);
                  if (connection) {
                    setNotice(`已切换到连接「${connection.name}」。`);
                    setFeedback(null);
                  }
                }}
                onDiscoverModels={() => startTransition(() => void handleDiscoverModels())}
                onToggleDiscoveredModelMenu={() => setShowDiscoveredModelMenu((current) => !current)}
                onChooseDiscoveredModel={(modelId) => {
                  updateModelForm({ modelName: modelId });
                  setShowDiscoveredModelMenu(false);
                }}
                onClearDiscoveredModel={() => {
                  setShowDiscoveredModelMenu(false);
                  updateModelForm({ modelName: "" });
                }}
                onSubmit={() => startTransition(() => void submitModelForm())}
                onCancelEdit={resetForm}
              />
            )}

            {/* ══ 管理已保存连接（可选面板）══ */}
            {builderMode === "connection" && (
              <ProviderConnectionPanel
                panelRef={connectionFormPanelRef}
                connectionForm={connectionForm}
                selectedConnectionTemplate={selectedConnectionTemplate}
                connectionProviderChoiceValue={connectionProviderChoiceValue}
                connectionDiscoverySupported={connectionDiscoverySupported}
                connectionFormAvatar={connectionFormAvatar}
                connectionFieldErrors={connectionFieldErrors}
                connectionFormFeedback={connectionFormFeedback}
                groupedConnectionTemplates={groupedConnectionTemplates}
                directCreateProviderChoices={directCreateProviderChoices}
                connections={connections}
                connectionDiscoveredModels={connectionDiscoveredModels}
                modelConnectionId={modelForm.connectionId}
                runningTestConnectionId={runningTestConnectionId}
                isBusy={Boolean(activeAction)}
                onBackToModelBuilder={() => {
                  switchBuilderMode("model");
                  resetConnectionForm();
                }}
                onConnectionNameChange={(value) => updateConnectionForm({ name: value })}
                onProviderChoiceChange={handleConnectionProviderChoice}
                onBaseUrlChange={(value) => updateConnectionForm({ baseUrl: value })}
                onApiKeyChange={(value) => updateConnectionForm({ apiKey: value })}
                onProbeModelNameChange={(value) => updateConnectionForm({ probeModelName: value })}
                onEnabledChange={(value) => updateConnectionForm({ enabled: value })}
                onSubmit={() => startTransition(() => void submitConnectionForm())}
                onCancelEdit={resetConnectionForm}
                onEditConnection={startEditingConnection}
                onUseConnectionForModel={(connection) => {
                  attachConnectionToModel(connection);
                  setNotice(`已选择连接「${connection.name}」。`);
                  setFeedback(null);
                }}
                onTestConnection={(connection) => startTransition(() => void testConnection(connection))}
                onDiscoverConnectionModels={(connection) =>
                  startTransition(() => void discoverConnectionModels(connection))
                }
                onRemoveConnection={(connection) => startTransition(() => void removeConnection(connection))}
                onUseDiscoveredModel={(connection, modelId) => {
                  attachConnectionToModel(connection, modelId);
                  setNotice(`已选择连接「${connection.name}」并填入模型 ID「${modelId}」。`);
                  setFeedback(null);
                }}
              />
            )}
          </div>
        </div>
        {/* ─ Model list ─ */}
        <ModelListPanel
          models={models}
          filteredModels={filteredModels}
          searchQuery={searchQuery}
          providerFilter={providerFilter}
          providerOptions={providerOptions}
          runningTestModelId={runningTestModelId}
          mockToolsEnabled={mockToolsEnabled}
          onSearchQueryChange={setSearchQuery}
          onProviderFilterChange={setProviderFilter}
          onFillLocalMockPreset={fillLocalMockPreset}
          onCreateLocalMocks={() => startTransition(() => void createLocalMocks())}
          onEditModel={(model) => {
            setBuilderMode("model");
            startEditingModel(model);
            setNotice(`正在编辑模型「${model.name}」。`);
          }}
          onTestModel={(model) => startTransition(() => void testModel(model))}
          onToggleModel={(model) => startTransition(() => void toggleModel(model))}
          onRemoveModel={(model) => startTransition(() => void removeModel(model))}
        />
      </section>
      </div>
    </main>
  );
}


