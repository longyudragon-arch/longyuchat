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
  getLocalMockBaseUrl,
  getProviderBadgeClassName,
  getProviderChineseLabel,
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

function Chip({ text, className }: { text: string; className: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{text}</span>;
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
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-7 py-9 sm:px-10 sm:py-12">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.24em] text-white/80 uppercase">
              配置中心
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl xl:leading-[1.1]">
              构建你的 AI <br />
              <span className="text-white/60">模型基础设施</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-lg">
              这里是整个系统的核心引擎。录入、测试并管理你的多模型入口。
              配置完成后，你可以在聊天房间中灵活编排它们的协作顺序。
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <div className="h-2 w-8 rounded-full bg-emerald-400 opacity-60" />
                <p className="mt-3 text-sm font-bold text-white/90">自动发现</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">支持从接口一键同步模型列表，减少手动配置。</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <div className="h-2 w-8 rounded-full bg-sky-400 opacity-60" />
                <p className="mt-3 text-sm font-bold text-white/90">健康监测</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">统一的连通性测试，实时掌握模型可用状态。</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <div className="h-2 w-8 rounded-full bg-amber-400 opacity-60" />
                <p className="mt-3 text-sm font-bold text-white/90">协作基线</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">预设回复上限与默认参数，确保协作链路稳定。</p>
              </div>
            </div>
          </div>
          {/* Decorative blur */}
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-blue-500 opacity-10 blur-[100px]" />
        </div>

        <div className="ly-glass flex flex-col rounded-[2.8rem] p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">操作面板</p>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">快速启动与调试</h2>
          <div className="mt-8 grid flex-1 gap-4">
            <Link href="/rooms/new" className="group flex items-center justify-between rounded-[2rem] bg-[var(--accent)] px-7 py-5 text-lg font-bold text-white transition-all hover:bg-[var(--accent-strong)] hover:shadow-[0_20px_40px_rgba(195,90,47,0.2)] active:scale-95">
              <span>创建聊天房间</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <button type="button" onClick={fillLocalMockPreset} className="flex items-center justify-between rounded-[2rem] border border-[var(--border)] bg-white/80 px-7 py-5 text-left font-bold transition-all hover:bg-white active:scale-95">
              <span>填入测试模型参数</span>
              <span className="text-[var(--muted)] opacity-30 text-xs">MOCK PRESET</span>
            </button>
            {mockToolsEnabled ? (
              <button type="button" onClick={() => startTransition(() => void createLocalMocks())} className="flex items-center justify-between rounded-[2rem] border border-[var(--border)] bg-white/80 px-7 py-5 text-left font-bold transition-all hover:bg-white active:scale-95">
                <span>生成本地 Mock 模型</span>
                <span className="text-[var(--muted)] opacity-30 text-xs">LOCAL TOOLS</span>
              </button>
            ) : null}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-black/5 px-5 py-4 text-sm text-[var(--muted)]">
            <span className="mt-0.5 text-lg">鉁</span>
            <p className="leading-relaxed">
              {activeAction ? "正在执行关键配置更新..." : notice || "建议先配置至少两个模型，以便体验顺序协作功能。"}
            </p>
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className="ly-glass rounded-[2.6rem] p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">配置工作台</p>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">{modelForm.id ? "编辑模型" : "新增模型"}</h2>
            
            <div className="mt-8 space-y-6">
              <div className="space-y-2.5">
                <label className="text-[13px] font-bold text-[var(--muted)] ml-1">显示名称</label>
                <input value={modelForm.name} onChange={(event) => updateModelForm({ name: event.target.value })} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/5" placeholder="例如：GPT-4 工作模型" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <label className="text-[13px] font-bold text-[var(--muted)] ml-1">提供商 (Provider)</label>
                  <select value={modelForm.provider} onChange={(event) => updateProvider(event.target.value as ProviderType)} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)]">
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {getProviderOptionLabel(provider)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-white/50 px-5 py-4">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-[10px] font-bold tracking-[0.2em] shadow-sm ${getProviderIconClassName(modelForm.provider)}`}>
                    {getProviderShortName(modelForm.provider)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold truncate">{getProviderChineseLabel(modelForm.provider)}</p>
                    <p className="text-[10px] text-[var(--muted)] uppercase font-bold opacity-60">Connected</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[13px] font-bold text-[var(--muted)] ml-1">Base URL 地址</label>
                <input value={modelForm.baseUrl} onChange={(event) => updateModelForm({ baseUrl: event.target.value })} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 font-mono text-[13px] outline-none transition focus:border-[var(--accent)]" />
              </div>

              <div className="space-y-2.5">
                <label className="text-[13px] font-bold text-[var(--muted)] ml-1">API Key</label>
                <input value={modelForm.apiKey} onChange={(event) => updateModelForm({ apiKey: event.target.value })} type="password" className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 font-mono text-[13px] outline-none transition focus:border-[var(--accent)]" placeholder={modelForm.id ? "••••••••••••••••" : "输入 API Key"} />
              </div>

              <div className="rounded-[2rem] border border-[var(--border)] bg-white/60 p-5 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">自动获取模型 ID</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)] leading-relaxed">{discoverySupported ? "支持从接口获取可用模型列表" : "当前 Provider 暂不支持此功能"}</p>
                  </div>
                  <button type="button" onClick={() => startTransition(() => void handleDiscoverModels())} disabled={!discoverySupported || !modelForm.baseUrl.trim() || !modelForm.apiKey.trim() || Boolean(activeAction)} className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold border border-[var(--border)] shadow-sm transition hover:bg-zinc-50 disabled:opacity-50">
                    {activeAction === "discovering" ? "正在获取..." : "获取列表"}
                  </button>
                </div>
                {discoveredModels.length > 0 ? (
                  <select value={discoveredModels.some((item) => item.id === modelForm.modelName) ? modelForm.modelName : ""} onChange={(event) => updateModelForm({ modelName: event.target.value })} className="mt-4 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-[var(--accent)]">
                    <option value="">请选择一个模型</option>
                    {discoveredModels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <label className="text-[13px] font-bold text-[var(--muted)] ml-1">模型 ID (Model)</label>
                  <input value={modelForm.modelName} onChange={(event) => updateModelForm({ modelName: event.target.value })} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 font-mono text-[13px] outline-none transition focus:border-[var(--accent)]" placeholder={selectedPreset.defaultModelName} />
                </div>
                <div className="space-y-2.5">
                  <label className="text-[13px] font-bold text-[var(--muted)] ml-1">默认回复字数上限</label>
                  <input type="number" min={50} max={4000} step={10} value={modelForm.defaultReplyLength} onChange={(event) => updateModelForm({ defaultReplyLength: Number.parseInt(event.target.value, 10) || modelForm.defaultReplyLength })} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)]" />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/40 px-5 py-4 transition-colors hover:bg-white/60 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded accent-[var(--accent)]" checked={modelForm.enabled} onChange={(event) => updateModelForm({ enabled: event.target.checked })} />
                <span className="text-sm font-bold text-[var(--muted)]">立即启用此模型</span>
              </label>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => startTransition(() => void submitModelForm())} disabled={Boolean(activeAction)} className="flex-1 rounded-[1.8rem] bg-[var(--accent)] px-6 py-4 text-base font-bold text-white shadow-lg shadow-[var(--accent)]/10 transition-all hover:bg-[var(--accent-strong)] active:scale-[0.98] disabled:opacity-50">
                  {modelForm.id ? "保存修改" : "创建模型配置"}
                </button>
                {modelForm.id ? (
                  <button type="button" onClick={resetForm} className="rounded-[1.8rem] border border-[var(--border)] bg-white/80 px-6 py-4 text-base font-bold text-[var(--muted)] transition-all hover:bg-white active:scale-[0.98]">
                    取消
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <section className="ly-glass rounded-[2.6rem] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">模型库存</p>
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight">管理与维护</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-black/5 px-4 py-2 text-xs font-bold text-[var(--muted)]">
                  共 {models.length} 个模型
                </span>
                {filteredModels.length !== models.length && (
                  <span className="rounded-full bg-[var(--accent)]/10 px-4 py-2 text-xs font-bold text-[var(--accent)]">
                    匹配 {filteredModels.length} 个
                  </span>
                )}
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_240px]">
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-30 group-focus-within:opacity-100 transition-opacity">馃敂</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型名称、ID 或接入地址..." className="w-full rounded-2xl border border-[var(--border)] bg-white/92 pl-12 pr-4 py-4 text-[15px] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/5" />
              </div>
              <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)]">
                <option value="ALL">全部提供商</option>
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
              <article key={model.id} className="ly-glass group rounded-[2.6rem] p-6 transition-all duration-300 hover:shadow-[0_24px_48px_rgba(17,17,17,0.06)] hover:-translate-y-1 sm:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-5">
                      <div className="relative">
                        <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] text-xs font-bold tracking-[0.2em] shadow-sm transition-transform group-hover:scale-110 ${getProviderIconClassName(model.provider)}`}>
                          {getProviderShortName(model.provider)}
                        </span>
                        {model.enabled && (
                          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl font-bold tracking-tight">{model.name}</h3>
                          <Chip text={model.enabled ? "已启用" : "已停用"} className={model.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold" : "border-zinc-200 bg-zinc-100 text-zinc-600 font-medium"} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2.5">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getProviderBadgeClassName(model.provider)}`}>{getProviderChineseLabel(model.provider)}</span>
                          <span className="rounded-full border border-[var(--border)] bg-white/60 px-3 py-1 text-[11px] font-medium text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)} 上限</span>
                          <TestState state={model.lastConnectionTest} running={runningTestModelId === model.id} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <button type="button" onClick={() => { setModelForm({ id: model.id, name: model.name, provider: model.provider, baseUrl: model.baseUrl, modelName: model.modelName, apiKey: "", defaultReplyLength: model.defaultReplyLength, enabled: model.enabled }); setDiscoveredModels([]); setNotice(`正在编辑模型「${model.name}」。`); }} className="rounded-full border border-[var(--border)] bg-white/80 px-5 py-2.5 text-sm font-bold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:bg-white hover:text-[var(--accent)] active:scale-95">编辑</button>
                      <button type="button" onClick={() => startTransition(() => void testModel(model))} className="rounded-full border border-[var(--border)] bg-white/80 px-5 py-2.5 text-sm font-bold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:bg-white hover:text-[var(--accent)] active:scale-95">{runningTestModelId === model.id ? "测试中..." : "测试连接"}</button>
                      <button type="button" onClick={() => startTransition(() => void toggleModel(model))} className="rounded-full border border-[var(--border)] bg-white/80 px-5 py-2.5 text-sm font-bold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:bg-white hover:text-[var(--accent)] active:scale-95">{model.enabled ? "停用" : "启用"}</button>
                      <button type="button" onClick={() => startTransition(() => void removeModel(model))} className="rounded-full border border-red-100 bg-white/80 px-5 py-2.5 text-sm font-bold text-red-500 transition-all hover:bg-red-50 active:scale-95">删除</button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[2.2rem] border border-[var(--border)] bg-white/50 px-5 py-5 sm:px-6 sm:py-6">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                        <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">接入详情</span>
                      </div>
                      <div className="mt-4 grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase">模型 ID</p>
                          <p className="mt-1 break-all font-mono text-sm font-medium text-[var(--foreground)]">{model.modelName || "未填写"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase">Base URL</p>
                          <p className="mt-1 break-all font-mono text-[13px] font-medium text-[var(--foreground)]">{model.baseUrl}</p>
                        </div>
                      </div>
                      <div className="mt-5 border-t border-[var(--border)] pt-4">
                        <p className="text-[11px] text-[var(--muted)] opacity-60 italic">最近更新于 {formatDate(model.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col rounded-[2.2rem] border border-[var(--border)] bg-white/60 px-5 py-5 sm:px-6 sm:py-6">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${model.lastConnectionTest?.status === "success" ? "bg-emerald-500" : "bg-red-400"}`} />
                        <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] uppercase">连接诊断报告</span>
                      </div>
                      <div className="mt-4 flex-1">
                        <p className="text-[13px] font-medium leading-[1.8] text-[var(--foreground)]">{formatModelTestMessage(model.lastConnectionTest)}</p>
                      </div>
                      {model.lastConnectionTest ? (
                        <div className="mt-4 border-t border-[var(--border)] pt-4">
                          <p className="text-[11px] text-[var(--muted)] opacity-60">最近诊断时间：{formatDate(model.lastConnectionTest.testedAt)}</p>
                        </div>
                      ) : null}
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
