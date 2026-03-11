"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  describeClientError,
  discoverProviderModels,
  ensureLocalMockModels,
  fetchJson,
  formatDate,
  formatReplyLength,
  getLocalMockBaseUrl,
  getProviderBadgeClassName,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderPreset,
  getProviderShortName,
  providerOptions,
  supportsLocalMockTools,
  supportsAutomaticModelDiscovery,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import type { DiscoveredModelView, ModelTestResultView, ModelView, ProviderType } from "@/types/app";

const defaultProvider = "OPENAI_COMPATIBLE" as ProviderType;

function createDefaultModelForm() {
  const preset = getProviderPreset(defaultProvider);

  return {
    id: "",
    name: "",
    provider: defaultProvider,
    baseUrl: preset.baseUrl,
    modelName: preset.defaultModelName,
    apiKey: "",
    defaultReplyLength: preset.defaultReplyLength,
    enabled: true,
  };
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`mt-4 rounded-[1.6rem] border px-4 py-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{feedback.title}</p>
      <p className="mt-2 text-sm leading-6">{feedback.description}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">建议：{feedback.suggestion}</p>
    </div>
  );
}

function ModelTestBadge({
  state,
  isRunning,
}: {
  state: ModelTestResultView | null;
  isRunning: boolean;
}) {
  if (isRunning) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-xs text-sky-900">
        <p className="font-semibold">正在执行连接测试</p>
        <p className="mt-1 leading-5">服务端正在向目标模型接口发起连通性验证。</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-3 text-xs text-[var(--muted)]">
        还没有执行过连接测试。
      </div>
    );
  }

  const className =
    state.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`rounded-2xl border px-3 py-3 text-xs ${className}`}>
      <p className="font-semibold">{state.status === "success" ? "最近一次连接测试成功" : "最近一次连接测试失败"}</p>
      <p className="mt-1 leading-5">{state.message}</p>
      <p className="mt-2 opacity-75">测试时间：{formatDate(state.testedAt)}</p>
    </div>
  );
}

export function ModelsPage() {
  const mockToolsEnabled = supportsLocalMockTools();
  const [models, setModels] = useState<ModelView[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [modelForm, setModelForm] = useState(createDefaultModelForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderType | "ALL">("ALL");
  const [runningTestModelId, setRunningTestModelId] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelView[]>([]);

  const isBusy = activeAction !== null;
  const selectedProviderPreset = getProviderPreset(modelForm.provider);
  const discoverySupported = supportsAutomaticModelDiscovery(modelForm.provider);
  const isDiscovering = activeAction === "discovering-models";

  async function loadModels() {
    const data = await fetchJson<{ models: ModelView[] }>("/api/models");
    setModels(data.models);
  }

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        model.name.toLowerCase().includes(normalizedQuery) ||
        model.modelName.toLowerCase().includes(normalizedQuery) ||
        model.baseUrl.toLowerCase().includes(normalizedQuery);

      const matchesProvider = providerFilter === "ALL" || model.provider === providerFilter;

      return matchesQuery && matchesProvider;
    });
  }, [models, providerFilter, searchQuery]);

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await loadModels();
      setNotice("模型列表已加载。");
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

  function clearDiscoveredModels() {
    setDiscoveredModels([]);
  }

  function updateModelForm(nextValue: Partial<ReturnType<typeof createDefaultModelForm>>) {
    if (nextValue.provider || nextValue.baseUrl !== undefined || nextValue.apiKey !== undefined) {
      clearDiscoveredModels();
    }

    setModelForm((current) => ({
      ...current,
      ...nextValue,
    }));
  }

  function resetModelForm() {
    setModelForm(createDefaultModelForm());
    clearDiscoveredModels();
  }

  function updateProvider(nextProvider: ProviderType) {
    const currentPreset = getProviderPreset(modelForm.provider);
    const nextPreset = getProviderPreset(nextProvider);

    updateModelForm({
      provider: nextProvider,
      baseUrl: nextPreset.baseUrl,
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

  function fillLocalMockPreset(name = "Mock Alpha", modelName = "mock-alpha") {
    setModelForm({
      id: "",
      name,
      provider: "OPENAI_COMPATIBLE",
      baseUrl: getLocalMockBaseUrl(),
      modelName,
      apiKey: "local-test-key",
      defaultReplyLength: 180,
      enabled: true,
    });
    setDiscoveredModels([
      { id: "mock-alpha", label: "mock-alpha", description: "local-mock" },
      { id: "mock-beta", label: "mock-beta", description: "local-mock" },
      { id: "mock-gamma", label: "mock-gamma", description: "local-mock" },
    ]);
    setNotice("已填入本地模拟模型参数。");
    setFeedback(null);
  }

  async function handleDiscoverModels() {
    if (!modelForm.baseUrl.trim() || !modelForm.apiKey.trim()) {
      setFeedback({
        title: "请先补全连接信息",
        description: "要自动获取模型列表，至少需要 Base URL 和 API Key。",
        suggestion: "先填写 Base URL 和 API Key，再点击“获取模型列表”。",
        tone: "warning",
      });
      return;
    }

    setActiveAction("discovering-models");
    setFeedback(null);

    try {
      const data = await discoverProviderModels({
        provider: modelForm.provider,
        baseUrl: modelForm.baseUrl,
        apiKey: modelForm.apiKey,
      });

      setDiscoveredModels(data.models);

      if (!modelForm.modelName || !data.models.some((model) => model.id === modelForm.modelName)) {
        updateModelForm({
          modelName: data.models[0]?.id ?? modelForm.modelName,
        });
      }

      setNotice(`已获取 ${data.models.length} 个可用模型。`);
    } catch (error: unknown) {
      clearDiscoveredModels();
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function submitModelForm() {
    setActiveAction(modelForm.id ? "updating-model" : "creating-model");
    setFeedback(null);

    try {
      const payload = {
        name: modelForm.name,
        provider: modelForm.provider,
        baseUrl: modelForm.baseUrl,
        modelName: modelForm.modelName,
        defaultReplyLength: modelForm.defaultReplyLength,
        enabled: modelForm.enabled,
        ...(modelForm.apiKey ? { apiKey: modelForm.apiKey } : {}),
      };

      if (modelForm.id) {
        await fetchJson(`/api/models/${modelForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice(`已更新“${modelForm.name}”。`);
      } else {
        await fetchJson("/api/models", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            apiKey: modelForm.apiKey,
          }),
        });
        setNotice(`已创建“${modelForm.name}”。`);
      }

      resetModelForm();
      await loadModels();
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleModelEnabled(model: ModelView) {
    setActiveAction("toggling-model");
    setFeedback(null);

    try {
      await fetchJson(`/api/models/${model.id}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: !model.enabled,
        }),
      });

      if (modelForm.id === model.id) {
        setModelForm((current) => ({
          ...current,
          enabled: !model.enabled,
        }));
      }

      await loadModels();
      setNotice(`${model.name} 已${model.enabled ? "停用" : "启用"}。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteModel(model: ModelView) {
    const shouldDelete = window.confirm(`确认删除模型“${model.name}”吗？`);

    if (!shouldDelete) {
      return;
    }

    setActiveAction("deleting-model");
    setFeedback(null);

    try {
      await fetchJson(`/api/models/${model.id}`, {
        method: "DELETE",
      });

      if (modelForm.id === model.id) {
        resetModelForm();
      }

      if (runningTestModelId === model.id) {
        setRunningTestModelId(null);
      }

      await loadModels();
      setNotice(`已删除模型“${model.name}”。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function testModelConnection(model: ModelView) {
    setActiveAction("testing-connection");
    setFeedback(null);
    setRunningTestModelId(model.id);

    try {
      await fetchJson(`/api/models/${model.id}/test`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      await loadModels();
      setNotice(`${model.name} 连接测试成功。`);
    } catch (error: unknown) {
      await loadModels();
      setFeedback(describeClientError(error));
    } finally {
      setRunningTestModelId(null);
      setActiveAction(null);
    }
  }

  async function createLocalMockModels() {
    setActiveAction("creating-local-models");
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

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] px-5 py-6 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs font-medium tracking-[0.18em] text-[var(--accent)]">
              MODELS
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">模型管理</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                在这里集中管理模型配置、默认回复字数、启停状态、连接测试和自动拉取模型列表。
              </p>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-[var(--border)] bg-white/75 px-4 py-3 text-sm text-[var(--muted)] lg:w-auto">
            {isBusy ? "处理中..." : notice || "配置好模型后，就可以去创建单聊或群聊。"}
          </div>
        </div>

        {feedback ? <FeedbackPanel feedback={feedback} /> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          {mockToolsEnabled ? (
            <div className="rounded-[2rem] border border-[var(--border)] bg-[rgba(191,95,54,0.08)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">Local Test</p>
              <h2 className="mt-3 text-2xl font-semibold">先用本地模拟接口跑通主流程</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                这里会自动填入本地 OpenAI-compatible mock 地址，方便先验证连接测试、模型发现、消息保存和顺序回复。
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => fillLocalMockPreset()}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  填入本地模拟参数
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(() => void createLocalMockModels())}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                >
                  一键创建本地模型
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{modelForm.id ? "编辑模型" : "新增模型"}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  大多数 OpenAI-compatible 服务都可以先拉模型列表，再选择具体模型。
                </p>
              </div>
              {modelForm.id ? (
                <button
                  type="button"
                  onClick={resetModelForm}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  取消编辑
                </button>
              ) : null}
            </div>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">模型名称</span>
                <input
                  value={modelForm.name}
                  onChange={(event) => updateModelForm({ name: event.target.value })}
                  placeholder="例如：OpenAI 主模型"
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Provider 类型</span>
                <select
                  value={modelForm.provider}
                  onChange={(event) => updateProvider(event.target.value as ProviderType)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                >
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {getProviderOptionLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(
                      modelForm.provider,
                    )}`}
                  >
                    {getProviderShortName(modelForm.provider)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {getProviderOptionLabel(modelForm.provider)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      下面的默认地址和默认回复字数会跟随当前 Provider 自动切换。
                    </p>
                  </div>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">Base URL 地址</span>
                <input
                  value={modelForm.baseUrl}
                  onChange={(event) => updateModelForm({ baseUrl: event.target.value })}
                  placeholder="例如：https://api.openai.com/v1"
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">API Key</span>
                <input
                  value={modelForm.apiKey}
                  onChange={(event) => updateModelForm({ apiKey: event.target.value })}
                  placeholder={modelForm.id ? "留空表示保留旧 API Key" : "输入模型 API Key"}
                  type="password"
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <div className="rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">自动获取模型列表</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                      {discoverySupported
                        ? "已支持当前 Provider。点击按钮后，服务端会使用你填写的 Base URL 和 API Key 拉取模型列表。"
                        : "当前 Provider 暂时还不支持自动获取模型列表，请先手动填写模型 ID。"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTransition(() => void handleDiscoverModels())}
                    disabled={!discoverySupported || !modelForm.baseUrl.trim() || !modelForm.apiKey.trim() || isBusy}
                    className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDiscovering ? "获取中..." : "获取模型列表"}
                  </button>
                </div>

                {discoveredModels.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[rgb(255,252,247)] px-4 py-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">从已获取列表中选择</span>
                      <select
                        value={discoveredModels.some((model) => model.id === modelForm.modelName) ? modelForm.modelName : ""}
                        onChange={(event) => updateModelForm({ modelName: event.target.value })}
                        className="w-full rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                      >
                        <option value="">请选择一个模型</option>
                        {discoveredModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      当前共获取到 {discoveredModels.length} 个模型。你也可以继续手动修改下面的模型 ID。
                    </p>
                    {modelForm.modelName ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        当前选择：{discoveredModels.find((model) => model.id === modelForm.modelName)?.description ??
                          modelForm.modelName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">模型 ID</span>
                <input
                  value={modelForm.modelName}
                  onChange={(event) => updateModelForm({ modelName: event.target.value })}
                  placeholder={selectedProviderPreset.defaultModelName || "例如：gpt-4.1-mini"}
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
                <p className="text-xs text-[var(--muted)]">
                  模型 ID 不是随便填的，必须填写当前 Provider 实际支持的模型名。
                  {selectedProviderPreset.defaultModelName
                    ? ` ${selectedProviderPreset.label} 可先试 ${selectedProviderPreset.defaultModelName}。`
                    : " 如果不确定，先点击“获取模型列表”，或去对应平台文档确认当前可用模型。"}
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">默认回复字数</span>
                <input
                  type="number"
                  min={50}
                  max={4000}
                  step={10}
                  value={modelForm.defaultReplyLength}
                  onChange={(event) => {
                    const nextValue = Number.parseInt(event.target.value, 10);
                    updateModelForm({
                      defaultReplyLength: Number.isNaN(nextValue) ? modelForm.defaultReplyLength : nextValue,
                    });
                  }}
                  placeholder="例如：300"
                  className="w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
                <p className="text-xs text-[var(--muted)]">
                  这里现在会作为严格字数上限生效。建议先从 200 到 400 字开始，能明显降低日常 token 消耗。
                </p>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={modelForm.enabled}
                  onChange={(event) => updateModelForm({ enabled: event.target.checked })}
                />
                <span>启用模型</span>
              </label>

              <button
                type="button"
                onClick={() => startTransition(() => void submitModelForm())}
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)]"
              >
                {modelForm.id ? "保存修改" : "创建模型"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">当前模型</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  可以按关键词和 Provider 筛选，也能查看最近一次连接测试状态。
                </p>
              </div>
              <Link
                href="/rooms/new"
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                去新建房间
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索模型名称、模型 ID 或 Base URL"
                className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              />
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
                className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              >
                <option value="ALL">全部 Provider</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {getProviderOptionLabel(provider)}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
              当前显示 {filteredModels.length} / {models.length} 个模型。
            </div>
          </div>

          <div className="space-y-3">
            {models.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-6 text-sm text-[var(--muted)]">
                {mockToolsEnabled
                  ? "还没有模型。你可以先新增一个真实模型，或者先创建本地 mock 模型。"
                  : "还没有模型。你可以先新增一个真实模型配置，再创建房间开始使用。"}
              </p>
            ) : filteredModels.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-6 text-sm text-[var(--muted)]">
                没有符合当前搜索条件的模型，试试清空关键词或切换 Provider 筛选。
              </p>
            ) : (
              filteredModels.map((model) => (
                <article
                  key={model.id}
                  className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(
                            model.provider,
                          )}`}
                        >
                          {getProviderShortName(model.provider)}
                        </span>
                        <div>
                          <h3 className="text-xl font-semibold">{model.name}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(
                                model.provider,
                              )}`}
                            >
                              {getProviderOptionLabel(model.provider)}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                model.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                              }`}
                            >
                              {model.enabled ? "已启用" : "已停用"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-[var(--muted)]">
                        <p>模型 ID：{model.modelName || "未填写"}</p>
                        <p>Base URL：{model.baseUrl}</p>
                        <p>默认回复字数：{formatReplyLength(model.defaultReplyLength)}</p>
                        <p className="text-xs">更新于 {formatDate(model.updatedAt)}</p>
                      </div>

                      <ModelTestBadge
                        state={model.lastConnectionTest}
                        isRunning={runningTestModelId === model.id}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setModelForm({
                            id: model.id,
                            name: model.name,
                            provider: model.provider,
                            baseUrl: model.baseUrl,
                            modelName: model.modelName,
                            apiKey: "",
                            defaultReplyLength: model.defaultReplyLength,
                            enabled: model.enabled,
                          });
                          clearDiscoveredModels();
                        }}
                        className="rounded-full border border-[var(--border)] px-3 py-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void toggleModelEnabled(model))}
                        className="rounded-full border border-[var(--border)] px-3 py-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {model.enabled ? "停用" : "启用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void testModelConnection(model))}
                        className="rounded-full border border-[var(--border)] px-3 py-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {runningTestModelId === model.id ? "测试中..." : "测试连接"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void deleteModel(model))}
                        className="rounded-full border border-red-200 px-3 py-2 text-red-600 transition hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
