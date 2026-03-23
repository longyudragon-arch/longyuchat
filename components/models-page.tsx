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
  supportsAutomaticModelDiscovery,
  supportsLocalMockTools,
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
  const tone =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`rounded-[1.6rem] border px-4 py-4 ${tone}`}>
      <p className="text-sm font-semibold">{feedback.title}</p>
      <p className="mt-2 text-sm leading-6">{feedback.description}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">建议：{feedback.suggestion}</p>
    </div>
  );
}

function TestState({ state, running }: { state: ModelTestResultView | null; running: boolean }) {
  if (running) {
    return <p className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700">测试中</p>;
  }

  if (!state) {
    return <p className="rounded-full bg-white px-3 py-1 text-xs text-[var(--muted)]">未测试</p>;
  }

  return (
    <p
      className={`rounded-full px-3 py-1 text-xs ${
        state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {state.status === "success" ? "测试成功" : "测试失败"}
    </p>
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

  const discoverySupported = supportsAutomaticModelDiscovery(modelForm.provider);
  const selectedPreset = getProviderPreset(modelForm.provider);

  async function loadModels() {
    const data = await fetchJson<{ models: ModelView[] }>("/api/models");
    setModels(data.models);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await loadModels();
      setNotice("模型中心已同步完成。");
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

  function updateModelForm(nextValue: Partial<ReturnType<typeof createDefaultModelForm>>) {
    if (nextValue.provider || nextValue.baseUrl !== undefined || nextValue.apiKey !== undefined) {
      setDiscoveredModels([]);
    }

    setModelForm((current) => ({ ...current, ...nextValue }));
  }

  function resetForm() {
    setModelForm(createDefaultModelForm());
    setDiscoveredModels([]);
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

  async function submitModelForm() {
    setActiveAction(modelForm.id ? "updating" : "creating");
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
        await fetchJson(`/api/models/${modelForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setNotice(`已更新模型「${modelForm.name}」。`);
      } else {
        await fetchJson("/api/models", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`已创建模型「${modelForm.name}」。`);
      }

      resetForm();
      await loadModels();
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDiscoverModels() {
    if (!modelForm.baseUrl.trim() || !modelForm.apiKey.trim()) {
      setFeedback({
        title: "请先补全连接信息",
        description: "自动获取模型列表需要 Base URL 和 API Key。",
        suggestion: "先填写 Base URL 与 API Key，再点击获取模型列表。",
        tone: "warning",
      });
      return;
    }

    setActiveAction("discovering");
    setFeedback(null);

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
      setNotice(`已发现 ${data.models.length} 个模型。`);
    } catch (error: unknown) {
      setDiscoveredModels([]);
      setFeedback(describeClientError(error));
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
      setNotice(`${model.name} 连接测试成功。`);
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
    if (!window.confirm(`确认删除模型「${model.name}」吗？`)) {
      return;
    }

    setActiveAction("deleting");
    setFeedback(null);

    try {
      await fetchJson(`/api/models/${model.id}`, { method: "DELETE" });
      if (modelForm.id === model.id) resetForm();
      await loadModels();
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
    setModelForm({
      id: "",
      name: "Mock Alpha",
      provider: "OPENAI_COMPATIBLE",
      baseUrl: getLocalMockBaseUrl(),
      modelName: "mock-alpha",
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

  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="ly-dark-panel ly-grid-lines rounded-[2.8rem] px-6 py-8 sm:px-8 sm:py-9">
          <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
            MODEL CENTER
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">把所有模型入口整理成一套可运营的配置中心</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">
            左边负责录入和自动发现，右边负责库存管理与测试。后续房间创建、顺序协作和聊天页都会直接复用这里的配置。
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">支持自动发现模型列表，减少手填出错。</div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">统一维护默认回复字数与连通状态。</div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">真实模型与本地 mock 都在同一套流程里运行。</div>
          </div>
        </div>

        <div className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">QUICK ACTIONS</p>
          <h2 className="mt-3 text-3xl font-semibold">让模型中心始终保持可用</h2>
          <div className="mt-6 grid gap-3">
            <Link href="/rooms/new" className="rounded-[1.6rem] bg-[var(--accent)] px-5 py-4 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]">
              去创建新的聊天房间
            </Link>
            <button type="button" onClick={fillLocalMockPreset} className="rounded-[1.6rem] border border-[var(--border)] bg-white/86 px-5 py-4 text-left text-sm font-medium">
              填入本地测试模型参数
            </button>
            {mockToolsEnabled ? (
              <button type="button" onClick={() => startTransition(() => void createLocalMocks())} className="rounded-[1.6rem] border border-[var(--border)] bg-white/86 px-5 py-4 text-left text-sm font-medium">
                一键创建本地 mock 模型
              </button>
            ) : null}
          </div>
          <div className="mt-6 rounded-[1.7rem] border border-[var(--border)] bg-white/78 px-4 py-4 text-sm text-[var(--muted)]">
            {activeAction ? "正在处理模型中心操作..." : notice || "先把模型配置好，再去房间里串起顺序协作。"}
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="xl:sticky xl:top-28 xl:self-start">
          <div className="ly-glass rounded-[2.5rem] p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">CONFIG LAB</p>
            <h2 className="mt-3 text-3xl font-semibold">{modelForm.id ? "编辑模型配置" : "新增模型配置"}</h2>
            <div className="mt-6 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium">模型名称</span>
                <input value={modelForm.name} onChange={(event) => updateModelForm({ name: event.target.value })} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]" placeholder="例如：产品主模型" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Provider 类型</span>
                <select value={modelForm.provider} onChange={(event) => updateProvider(event.target.value as ProviderType)} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]">
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {getProviderOptionLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-3 rounded-[1.4rem] border border-[var(--border)] bg-white/78 px-4 py-3">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.24em] ${getProviderIconClassName(modelForm.provider)}`}>
                  {getProviderShortName(modelForm.provider)}
                </span>
                <div>
                  <p className="text-sm font-medium">{getProviderOptionLabel(modelForm.provider)}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">默认地址与默认模型会随这里联动。</p>
                </div>
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium">Base URL 地址</span>
                <input value={modelForm.baseUrl} onChange={(event) => updateModelForm({ baseUrl: event.target.value })} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 font-mono text-sm outline-none transition focus:border-[var(--accent)]" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">API Key</span>
                <input value={modelForm.apiKey} onChange={(event) => updateModelForm({ apiKey: event.target.value })} type="password" className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 font-mono text-sm outline-none transition focus:border-[var(--accent)]" placeholder={modelForm.id ? "留空表示保留当前 Key" : "输入模型 API Key"} />
              </label>
              <div className="rounded-[1.7rem] border border-[var(--border)] bg-white/78 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">自动发现模型列表</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{discoverySupported ? "当前 Provider 支持自动发现。" : "当前 Provider 暂不支持自动发现。"}</p>
                  </div>
                  <button type="button" onClick={() => startTransition(() => void handleDiscoverModels())} disabled={!discoverySupported || !modelForm.baseUrl.trim() || !modelForm.apiKey.trim() || Boolean(activeAction)} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm disabled:opacity-50">
                    {activeAction === "discovering" ? "获取中..." : "获取模型列表"}
                  </button>
                </div>
                {discoveredModels.length > 0 ? (
                  <select value={discoveredModels.some((item) => item.id === modelForm.modelName) ? modelForm.modelName : ""} onChange={(event) => updateModelForm({ modelName: event.target.value })} className="mt-4 w-full rounded-[1.2rem] border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]">
                    <option value="">请选择一个模型</option>
                    {discoveredModels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <label className="space-y-2">
                <span className="text-sm font-medium">模型 ID</span>
                <input value={modelForm.modelName} onChange={(event) => updateModelForm({ modelName: event.target.value })} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 font-mono text-sm outline-none transition focus:border-[var(--accent)]" placeholder={selectedPreset.defaultModelName || "例如：gpt-4.1-mini"} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">默认回复字数上限</span>
                <input type="number" min={50} max={4000} step={10} value={modelForm.defaultReplyLength} onChange={(event) => updateModelForm({ defaultReplyLength: Number.parseInt(event.target.value, 10) || modelForm.defaultReplyLength })} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]" />
              </label>
              <label className="flex items-center gap-3 rounded-[1.4rem] border border-[var(--border)] bg-white/86 px-4 py-3 text-sm text-[var(--muted)]">
                <input type="checkbox" checked={modelForm.enabled} onChange={(event) => updateModelForm({ enabled: event.target.checked })} />
                <span>立即启用这个模型</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => startTransition(() => void submitModelForm())} className="flex-1 rounded-[1.5rem] bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]">
                  {modelForm.id ? "保存配置" : "创建模型"}
                </button>
                {modelForm.id ? (
                  <button type="button" onClick={resetForm} className="rounded-[1.5rem] border border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
                    取消
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <section className="ly-glass rounded-[2.3rem] p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">MODEL INVENTORY</p>
                <h2 className="mt-2 text-2xl font-semibold">从库存里筛选、测试和维护模型</h2>
              </div>
              <div className="rounded-full border border-[var(--border)] bg-white/78 px-4 py-2 text-sm text-[var(--muted)]">当前显示 {filteredModels.length} / {models.length} 个模型</div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型名称、模型 ID 或 Base URL" className="rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]" />
              <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]">
                <option value="ALL">全部 Provider</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {getProviderOptionLabel(provider)}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {models.length === 0 ? (
            <div className="ly-glass rounded-[2.2rem] px-6 py-8 text-sm leading-7 text-[var(--muted)]">
              {mockToolsEnabled ? "还没有模型。可以先录入真实模型，或者先生成本地 mock 模型来验证聊天流程。" : "还没有模型。请先在左侧创建第一条模型配置。"}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="ly-glass rounded-[2.2rem] px-6 py-8 text-sm leading-7 text-[var(--muted)]">当前筛选条件下没有匹配模型，试试清空关键词或切换 Provider。</div>
          ) : (
            filteredModels.map((model) => (
              <article key={model.id} className="ly-glass rounded-[2.3rem] p-5 transition hover:-translate-y-1 sm:p-6">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.4rem] text-xs font-semibold tracking-[0.24em] ${getProviderIconClassName(model.provider)}`}>
                        {getProviderShortName(model.provider)}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold">{model.name}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${model.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
                            {model.enabled ? "已启用" : "已停用"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(model.provider)}`}>{getProviderOptionLabel(model.provider)}</span>
                          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)}</span>
                          <TestState state={model.lastConnectionTest} running={runningTestModelId === model.id} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <button type="button" onClick={() => { setModelForm({ id: model.id, name: model.name, provider: model.provider, baseUrl: model.baseUrl, modelName: model.modelName, apiKey: "", defaultReplyLength: model.defaultReplyLength, enabled: model.enabled }); setDiscoveredModels([]); setNotice(`正在编辑模型「${model.name}」。`); }} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">编辑</button>
                      <button type="button" onClick={() => startTransition(() => void toggleModel(model))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">{model.enabled ? "停用" : "启用"}</button>
                      <button type="button" onClick={() => startTransition(() => void testModel(model))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">{runningTestModelId === model.id ? "测试中..." : "测试连接"}</button>
                      <button type="button" onClick={() => startTransition(() => void removeModel(model))} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 transition hover:bg-red-50">删除</button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                    <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/84 px-4 py-4">
                      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent-strong)]">ENDPOINT</p>
                      <p className="mt-3 text-sm font-medium">模型 ID</p>
                      <p className="mt-1 break-all font-mono text-sm text-[var(--muted)]">{model.modelName || "未填写"}</p>
                      <p className="mt-4 text-sm font-medium">Base URL</p>
                      <p className="mt-1 break-all font-mono text-sm text-[var(--muted)]">{model.baseUrl}</p>
                      <p className="mt-4 text-xs text-[var(--muted)]">最近更新于 {formatDate(model.updatedAt)}</p>
                    </div>
                    <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/84 px-4 py-4 text-sm text-[var(--muted)]">
                      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent-strong)]">CONNECTION</p>
                      <p className="mt-3 leading-6">{model.lastConnectionTest?.message ?? "还没有执行过连接测试。"}</p>
                      {model.lastConnectionTest ? <p className="mt-3 text-xs">最近测试时间：{formatDate(model.lastConnectionTest.testedAt)}</p> : null}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
