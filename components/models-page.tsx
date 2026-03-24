"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  describeClientError,
  discoverProviderModels,
  ensureLocalMockModels,
  fetchJson,
  formatDate,
  formatModelTestMessage,
  formatReplyLength,
  getProviderBadgeClassName,
  getProviderChineseLabel,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderPreset,
  getProviderShortName,
  getLocalMockBaseUrl,
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
    if (!window.confirm(`确认删除模型「${model.name}」吗？`)) return;
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
    <main className="ly-shell flex flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7">
      {/* ─ Page header ─ */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-display font-bold tracking-tight sm:text-2xl">模型管理</h1>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--muted)] sm:text-[13px]">
            共 {models.length} 个模型 · 配置、测试并管理你的多模型入口
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rooms/new" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95">
            新建房间
          </Link>
          <button type="button" onClick={fillLocalMockPreset} className="rounded-xl border border-white/40 bg-white/30 px-4 py-2 text-[13px] font-bold text-[var(--muted)] backdrop-blur-lg transition-all hover:bg-white/60 active:scale-95">
            测试预设
          </button>
          {mockToolsEnabled && (
            <button type="button" onClick={() => startTransition(() => void createLocalMocks())} className="rounded-xl border border-white/40 bg-white/30 px-4 py-2 text-[13px] font-bold text-[var(--muted)] backdrop-blur-lg transition-all hover:bg-white/60 active:scale-95">
              Mock 模型
            </button>
          )}
        </div>
      </section>

      {notice && (
        <div className="rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/10 px-4 py-2 text-[12px] font-medium text-[var(--accent)]">
          {notice}
        </div>
      )}

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      {/* ─ Form + List layout ─ */}
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        {/* ─ Model form ─ */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="ly-glass rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/5">
            <h2 className="text-lg font-display font-bold tracking-tight">{modelForm.id ? "编辑模型" : "新增模型"}</h2>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">显示名称</label>
                <input value={modelForm.name} onChange={(e) => updateModelForm({ name: e.target.value })} className="w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 text-[14px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-xl" placeholder="例如：GPT-4 工作模型" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">提供商</label>
                  <select value={modelForm.provider} onChange={(e) => updateProvider(e.target.value as ProviderType)} className="w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 text-[14px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-xl appearance-none">
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>{getProviderOptionLabel(provider)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/30 bg-[var(--foreground)]/5 px-3 py-2.5">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm ${getProviderIconClassName(modelForm.provider)}`}>
                    {getProviderShortName(modelForm.provider)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate">{getProviderChineseLabel(modelForm.provider)}</p>
                    <p className="text-[9px] text-[var(--accent)] uppercase font-bold tracking-widest">当前选择</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">Base URL</label>
                <input value={modelForm.baseUrl} onChange={(e) => updateModelForm({ baseUrl: e.target.value })} className="w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 font-mono text-[12px] outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-xl" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">API Key</label>
                <input value={modelForm.apiKey} onChange={(e) => updateModelForm({ apiKey: e.target.value })} type="password" className="w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 font-mono text-[12px] outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-xl tracking-widest placeholder:tracking-normal" placeholder={modelForm.id ? "••••••••••••••••" : "输入 API Key"} />
              </div>

              {/* Model discovery */}
              <div className="rounded-xl border border-white/40 bg-white/30 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">自动获取模型 ID</p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">{discoverySupported ? "支持从接口获取" : "当前 Provider 暂不支持"}</p>
                  </div>
                  <button type="button" onClick={() => startTransition(() => void handleDiscoverModels())} disabled={!discoverySupported || !modelForm.baseUrl.trim() || !modelForm.apiKey.trim() || Boolean(activeAction)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold border border-black/5 shadow-sm transition hover:shadow-md disabled:opacity-50">
                    {activeAction === "discovering" ? "获取中..." : "获取列表"}
                  </button>
                </div>
                {discoveredModels.length > 0 && (
                  <select value={discoveredModels.some((i) => i.id === modelForm.modelName) ? modelForm.modelName : ""} onChange={(e) => updateModelForm({ modelName: e.target.value })} className="mt-3 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] font-medium outline-none transition focus:border-[var(--accent)] appearance-none">
                    <option value="">请选择一个模型</option>
                    {discoveredModels.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">模型 ID</label>
                  <input value={modelForm.modelName} onChange={(e) => updateModelForm({ modelName: e.target.value })} className="w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 font-mono text-[12px] outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-xl" placeholder={selectedPreset.defaultModelName} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">回复字数上限</label>
                  <input type="number" min={50} max={4000} step={10} value={modelForm.defaultReplyLength} onChange={(e) => updateModelForm({ defaultReplyLength: Number.parseInt(e.target.value, 10) || modelForm.defaultReplyLength })} className="w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 text-[14px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-xl" />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/20 px-4 py-3 transition hover:bg-white/20 cursor-pointer backdrop-blur-lg">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-opacity h-5 w-5 opacity-0 absolute" checked={modelForm.enabled} onChange={(e) => updateModelForm({ enabled: e.target.checked })} />
                  <div className="h-5 w-5 rounded-md border-2 border-[var(--muted)]/30 bg-white/30 transition-all peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)] flex items-center justify-center">
                    <svg className={`w-3 h-3 text-white transition-transform duration-300 ${modelForm.enabled ? 'scale-100' : 'scale-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-[13px] font-bold">立即启用此模型</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => startTransition(() => void submitModelForm())} disabled={Boolean(activeAction)} className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 text-[14px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:opacity-50">
                  {modelForm.id ? "保存修改" : "创建模型"}
                </button>
                {modelForm.id && (
                  <button type="button" onClick={resetForm} className="rounded-xl border border-white/40 bg-white/30 px-5 py-3 text-[14px] font-bold text-[var(--muted)] transition hover:bg-white/60 active:scale-95">
                    取消
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─ Model list ─ */}
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索模型名称、ID 或接入地址..." className="flex-1 rounded-xl border border-white/40 bg-white/20 px-4 py-2.5 text-[13px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-lg" />
            <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as ProviderType | "ALL")} className="rounded-xl border border-white/40 bg-white/20 px-3 py-2.5 text-[13px] font-bold outline-none transition focus:bg-white focus:border-[var(--accent)] backdrop-blur-lg appearance-none cursor-pointer">
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
            <div className="ly-glass rounded-xl px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)]">
              {mockToolsEnabled ? "还没有模型。可以先录入真实模型，或先生成本地 mock 模型。" : "还没有模型。请在左侧创建第一条模型配置。"}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="ly-glass rounded-xl px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)]">
              没有匹配模型，试试清空关键词或切换 Provider。
            </div>
          ) : (
            filteredModels.map((model) => (
              <article key={model.id} className="ly-glass group rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 sm:rounded-2xl sm:p-5">
                {/* Top row: icon + name + badges + actions */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-[11px] font-bold tracking-wide shadow-md transition-transform duration-300 group-hover:scale-105 ${getProviderIconClassName(model.provider)}`}>
                      {getProviderShortName(model.provider)}
                    </span>
                    {model.enabled && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-display font-bold tracking-tight">{model.name}</h3>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${model.enabled ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700" : "border-black/10 bg-black/5 text-[var(--muted)]"}`}>
                        {model.enabled ? "已启用" : "已停用"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${getProviderBadgeClassName(model.provider)}`}>{getProviderChineseLabel(model.provider)}</span>
                      <span className="rounded-md border border-white/60 bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)} 上限</span>
                      <TestState state={model.lastConnectionTest} running={runningTestModelId === model.id} />
                    </div>
                  </div>
                </div>

                {/* Details row */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 rounded-lg border border-white/30 bg-white/20 px-3.5 py-3">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider">模型 ID</p>
                    <p className="mt-0.5 break-all font-mono text-[12px] font-bold">{model.modelName || "未填写"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider">Base URL</p>
                    <p className="mt-0.5 break-all font-mono text-[11px] font-bold leading-relaxed">{model.baseUrl}</p>
                  </div>
                </div>

                {/* Test result inline */}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-[var(--muted)] opacity-60 truncate flex-1 mr-3">
                    {model.lastConnectionTest
                      ? `测试于 ${formatDate(model.lastConnectionTest.testedAt)} — ${formatModelTestMessage(model.lastConnectionTest)}`
                      : `更新于 ${formatDate(model.updatedAt)}`}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" onClick={() => { setModelForm({ id: model.id, name: model.name, provider: model.provider, baseUrl: model.baseUrl, modelName: model.modelName, apiKey: "", defaultReplyLength: model.defaultReplyLength, enabled: model.enabled }); setDiscoveredModels([]); setNotice(`正在编辑模型「${model.name}」。`); }} className="rounded-md border border-white/60 bg-white/20 px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] transition hover:bg-white hover:text-[var(--accent)] active:scale-95">编辑</button>
                    <button type="button" onClick={() => startTransition(() => void testModel(model))} className="rounded-md border border-white/60 bg-white/20 px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] transition hover:bg-white hover:text-sky-600 active:scale-95">{runningTestModelId === model.id ? "测试中" : "测试"}</button>
                    <button type="button" onClick={() => startTransition(() => void toggleModel(model))} className="rounded-md border border-white/60 bg-white/20 px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] transition hover:bg-white hover:text-amber-600 active:scale-95">{model.enabled ? "停用" : "启用"}</button>
                    <button type="button" onClick={() => startTransition(() => void removeModel(model))} className="rounded-md border border-red-200/50 bg-red-50/50 px-3 py-1.5 text-[11px] font-bold text-red-500 transition hover:bg-red-500 hover:text-white active:scale-95">删除</button>
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
