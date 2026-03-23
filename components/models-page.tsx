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
      ? "border-amber-200/50 bg-amber-50/80 text-amber-900 shadow-amber-500/10"
      : "border-red-200/50 bg-red-50/80 text-red-900 shadow-red-500/10";

  return (
    <div className={`rounded-[2rem] border px-6 py-5 shadow-lg backdrop-blur-md ${tone}`}>
      <p className="text-[15px] font-bold tracking-tight">{feedback.title}</p>
      <p className="mt-2 text-[14px] leading-relaxed opacity-90">{feedback.description}</p>
      <p className="mt-3 text-[13px] font-medium leading-relaxed opacity-80 border-t border-black/5 pt-3">建议：{feedback.suggestion}</p>
    </div>
  );
}

function Chip({ text, className }: { text: string; className: string }) {
  return <span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase ${className}`}>{text}</span>;
}

function TestState({ state, running }: { state: ModelTestResultView | null; running: boolean }) {
  if (running) {
    return <p className="rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-[11px] font-bold text-sky-600 tracking-wide uppercase shadow-[0_0_12px_rgba(14,165,233,0.2)] animate-pulse">测试中</p>;
  }

  if (!state) {
    return <p className="rounded-full bg-black/5 border border-black/10 px-3 py-1 text-[11px] font-bold text-[var(--muted)] tracking-wide uppercase">未测试</p>;
  }

  return (
    <p
      className={`rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${
        state.status === "success" 
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.15)]" 
          : "bg-red-500/10 border-red-500/20 text-red-600 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
      }`}
    >
      {state.status === "success" ? "连接成功" : "连接失败"}
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
    <main className="ly-shell flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[3.5rem] px-8 py-10 sm:px-12 sm:py-14 shadow-2xl">
          <div className="relative z-10 animate-fade-in-up">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.24em] text-white/90 uppercase backdrop-blur-md shadow-inner">
              配置中心
            </span>
            <h1 className="mt-8 text-5xl font-display font-bold tracking-tight sm:text-6xl xl:text-[4.5rem] xl:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60">
              构建你的 AI <br />
              <span className="text-white/40 font-light">模型基础设施</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[1.0625rem] font-medium leading-[1.8] text-white/70">
              这里是整个系统的核心引擎。录入、测试并管理你的多模型入口。
              配置完成后，你可以在聊天房间中灵活编排它们的协作顺序。
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm group">
                <div className="h-2 w-8 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all group-hover:w-12" />
                <p className="mt-4 text-[15px] font-bold text-white/90">自动发现</p>
                <p className="mt-2 text-[13px] text-white/50 leading-relaxed font-medium">支持从接口一键同步模型列表，减少手动配置。</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm group">
                <div className="h-2 w-8 rounded-full bg-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-all group-hover:w-12" />
                <p className="mt-4 text-[15px] font-bold text-white/90">健康监测</p>
                <p className="mt-2 text-[13px] text-white/50 leading-relaxed font-medium">统一的连通性测试，实时掌握模型可用状态。</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm group">
                <div className="h-2 w-8 rounded-full bg-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.5)] transition-all group-hover:w-12" />
                <p className="mt-4 text-[15px] font-bold text-white/90">协作基线</p>
                <p className="mt-2 text-[13px] text-white/50 leading-relaxed font-medium">预设回复上限与默认参数，确保协作链路稳定。</p>
              </div>
            </div>
          </div>
          {/* Decorative blur */}
          <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-15 blur-[120px] animate-pulse-slow" />
        </div>

        <div className="ly-glass flex flex-col rounded-[3.5rem] p-8 sm:p-10 shadow-xl shadow-[var(--accent)]/5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">操作面板</p>
          </div>
          <h2 className="mt-5 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">快速启动与调试</h2>
          <div className="mt-10 grid flex-1 gap-5">
            <Link href="/rooms/new" className="group relative flex items-center justify-between rounded-[2rem] bg-[linear-gradient(135deg,#993c50,#c7576f)] px-8 py-6 text-lg font-display font-bold text-white transition-all duration-500 hover:shadow-[0_24px_48px_rgba(153,60,80,0.3)] hover:-translate-y-1 active:scale-[0.98] overflow-hidden">
              <span className="relative z-10">创建聊天房间</span>
              <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-2">→</span>
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
            </Link>
            <button type="button" onClick={fillLocalMockPreset} className="flex items-center justify-between rounded-[2rem] border border-white/40 bg-white/30 px-8 py-6 text-left font-bold transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md">
              <span className="text-[15px] text-[var(--foreground)]">填入测试模型参数</span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-50 uppercase">测试预设</span>
            </button>
            {mockToolsEnabled ? (
              <button type="button" onClick={() => startTransition(() => void createLocalMocks())} className="flex items-center justify-between rounded-[2rem] border border-white/40 bg-white/30 px-8 py-6 text-left font-bold transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md">
                <span className="text-[15px] text-[var(--foreground)]">生成本地 Mock 模型</span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-50 uppercase">本地工具</span>
              </button>
            ) : null}
          </div>
          <div className="mt-8 flex items-start gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white/40 px-6 py-5 text-[14px] text-[var(--muted)] backdrop-blur-sm transition-colors hover:bg-white/60">
            <span className="mt-0.5 inline-flex rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[12px] font-bold text-[var(--accent)]">提示</span>
            <p className="leading-relaxed font-medium">
              {activeAction ? "正在执行关键配置更新..." : notice || "建议先配置至少两个模型，以便体验顺序协作功能。"}
            </p>
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="xl:sticky xl:top-28 xl:self-start">
          <div className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-xl shadow-black/5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">配置工作台</p>
            </div>
            <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">{modelForm.id ? "编辑模型" : "新增模型"}</h2>
            
            <div className="mt-10 space-y-7">
              <div className="space-y-3">
                <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">显示名称</label>
                <input value={modelForm.name} onChange={(event) => updateModelForm({ name: event.target.value })} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner" placeholder="例如：GPT-4 工作模型" />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">提供商</label>
                  <select value={modelForm.provider} onChange={(event) => updateProvider(event.target.value as ProviderType)} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md appearance-none">
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {getProviderOptionLabel(provider)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-5 rounded-[1.5rem] border border-white/30 bg-[var(--foreground)]/5 px-6 py-4 backdrop-blur-sm">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.25rem] text-[11px] font-bold tracking-[0.2em] shadow-md ${getProviderIconClassName(modelForm.provider)}`}>
                    {getProviderShortName(modelForm.provider)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold truncate text-[var(--foreground)]">{getProviderChineseLabel(modelForm.provider)}</p>
                    <p className="mt-1 text-[10px] text-[var(--accent)] uppercase font-bold tracking-widest">当前选择</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">Base URL 地址</label>
                <input value={modelForm.baseUrl} onChange={(event) => updateModelForm({ baseUrl: event.target.value })} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 font-mono text-[13px] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md shadow-inner" />
              </div>

              <div className="space-y-3">
                <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">API Key</label>
                <input value={modelForm.apiKey} onChange={(event) => updateModelForm({ apiKey: event.target.value })} type="password" className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 font-mono text-[13px] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md shadow-inner tracking-widest placeholder:tracking-normal" placeholder={modelForm.id ? "••••••••••••••••" : "输入 API Key"} />
              </div>

              <div className="rounded-[2rem] border border-white/40 bg-white/30 p-6 backdrop-blur-md shadow-[inset_0_2px_12px_rgba(0,0,0,0.02)] transition-colors hover:bg-white/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-[var(--foreground)]">自动获取模型 ID</p>
                    <p className="mt-1.5 text-[12px] font-medium text-[var(--muted)] leading-relaxed">{discoverySupported ? "支持从接口获取可用模型列表" : "当前 Provider 暂不支持此功能"}</p>
                  </div>
                  <button type="button" onClick={() => startTransition(() => void handleDiscoverModels())} disabled={!discoverySupported || !modelForm.baseUrl.trim() || !modelForm.apiKey.trim() || Boolean(activeAction)} className="shrink-0 rounded-[1.25rem] bg-white px-5 py-3 text-[13px] font-bold border border-black/5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm">
                    {activeAction === "discovering" ? "正在获取..." : "获取列表"}
                  </button>
                </div>
                {discoveredModels.length > 0 ? (
                  <select value={discoveredModels.some((item) => item.id === modelForm.modelName) ? modelForm.modelName : ""} onChange={(event) => updateModelForm({ modelName: event.target.value })} className="mt-5 w-full rounded-[1.25rem] border border-[var(--border)] bg-white px-5 py-4 text-[14px] font-medium outline-none transition-all duration-300 focus:border-[var(--accent)] shadow-sm appearance-none">
                    <option value="">请选择一个模型</option>
                    {discoveredModels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">模型 ID</label>
                  <input value={modelForm.modelName} onChange={(event) => updateModelForm({ modelName: event.target.value })} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 font-mono text-[13px] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md shadow-inner" placeholder={selectedPreset.defaultModelName} />
                </div>
                <div className="space-y-3">
                  <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">默认回复字数上限</label>
                  <input type="number" min={50} max={4000} step={10} value={modelForm.defaultReplyLength} onChange={(event) => updateModelForm({ defaultReplyLength: Number.parseInt(event.target.value, 10) || modelForm.defaultReplyLength })} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md shadow-inner" />
                </div>
              </div>

              <label className="flex items-center gap-4 rounded-[1.5rem] border border-white/30 bg-white/20 px-6 py-5 transition-all duration-300 hover:bg-white/40 hover:border-white/50 cursor-pointer backdrop-blur-sm group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-opacity h-5 w-5 opacity-0 absolute" checked={modelForm.enabled} onChange={(event) => updateModelForm({ enabled: event.target.checked })} />
                  <div className="h-6 w-6 rounded-md border-2 border-[var(--muted)]/30 bg-white/50 transition-all peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)] flex items-center justify-center shadow-inner">
                    <svg className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${modelForm.enabled ? 'scale-100' : 'scale-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-[15px] font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">立即启用此模型</span>
              </label>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => startTransition(() => void submitModelForm())} disabled={Boolean(activeAction)} className="flex-1 rounded-full bg-[linear-gradient(135deg,#993c50,#c7576f)] px-8 py-5 text-[16px] font-bold text-white shadow-[0_12px_24px_rgba(153,60,80,0.2)] transition-all duration-300 hover:shadow-[0_20px_40px_rgba(153,60,80,0.3)] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0">
                  {modelForm.id ? "保存修改" : "创建模型配置"}
                </button>
                {modelForm.id ? (
                  <button type="button" onClick={resetForm} className="rounded-full border border-white/40 bg-white/30 px-8 py-5 text-[16px] font-bold text-[var(--muted)] transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md">
                    取消
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <section className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-lg shadow-black/5">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
                  <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">模型库存</p>
                </div>
                <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">管理与维护</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/50 border border-white/60 px-5 py-2.5 text-[12px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm">
                  共 {models.length} 个模型
                </span>
                {filteredModels.length !== models.length && (
                  <span className="rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-5 py-2.5 text-[12px] font-bold text-[var(--accent)] shadow-sm backdrop-blur-sm">
                    匹配 {filteredModels.length} 个
                  </span>
                )}
              </div>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-[1fr_260px]">
              <div className="relative group">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--muted)]/50 group-focus-within:text-[var(--accent)] transition-all duration-300">搜索</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型名称、ID 或接入地址..." className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 pl-14 pr-6 py-5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner" />
              </div>
              <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 px-6 py-5 text-[15px] font-bold text-[var(--foreground)] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md appearance-none shadow-sm cursor-pointer">
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
            <div className="ly-glass rounded-[3rem] px-8 py-12 text-[15px] font-medium leading-relaxed text-[var(--muted)] text-center shadow-sm">
              {mockToolsEnabled ? "还没有模型。可以先录入真实模型，或者先生成本地 mock 模型来验证聊天流程。" : "还没有模型。请先在左侧创建第一条模型配置。"}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="ly-glass rounded-[3rem] px-8 py-12 text-[15px] font-medium leading-relaxed text-[var(--muted)] text-center shadow-sm">当前筛选条件下没有匹配模型，试试清空关键词或切换 Provider。</div>
          ) : (
            filteredModels.map((model) => (
              <article key={model.id} className="ly-glass group rounded-[3rem] p-7 transition-all duration-500 hover:shadow-[0_32px_64px_rgba(47,46,51,0.08)] hover:border-white/80 hover:-translate-y-1.5 sm:p-10">
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-6">
                      <div className="relative shrink-0">
                        <span className={`inline-flex h-16 w-16 items-center justify-center rounded-[1.75rem] text-[13px] font-bold tracking-[0.2em] shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${getProviderIconClassName(model.provider)}`}>
                          {getProviderShortName(model.provider)}
                        </span>
                        {model.enabled && (
                          <span className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500 shadow-sm" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-4">
                          <h3 className="text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">{model.name}</h3>
                          <Chip text={model.enabled ? "已启用" : "已停用"} className={model.enabled ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.1)]" : "border-black/10 bg-black/5 text-[var(--muted)]"} />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className={`rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase shadow-sm ${getProviderBadgeClassName(model.provider)}`}>{getProviderChineseLabel(model.provider)}</span>
                          <span className="rounded-full border border-white/60 bg-white/40 px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase text-[var(--muted)] shadow-sm backdrop-blur-sm">{formatReplyLength(model.defaultReplyLength)} 上限</span>
                          <TestState state={model.lastConnectionTest} running={runningTestModelId === model.id} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:justify-end pt-2 lg:pt-0">
                      <button type="button" onClick={() => { setModelForm({ id: model.id, name: model.name, provider: model.provider, baseUrl: model.baseUrl, modelName: model.modelName, apiKey: "", defaultReplyLength: model.defaultReplyLength, enabled: model.enabled }); setDiscoveredModels([]); setNotice(`正在编辑模型「${model.name}」。`); }} className="rounded-full border border-white/60 bg-white/40 px-6 py-3 text-[13px] font-bold text-[var(--muted)] transition-all duration-300 hover:bg-white hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-md active:scale-95 backdrop-blur-sm">编辑</button>
                      <button type="button" onClick={() => startTransition(() => void testModel(model))} className="rounded-full border border-white/60 bg-white/40 px-6 py-3 text-[13px] font-bold text-[var(--muted)] transition-all duration-300 hover:bg-white hover:border-sky-400 hover:text-sky-600 hover:shadow-md active:scale-95 backdrop-blur-sm">{runningTestModelId === model.id ? "测试中" : "测试连接"}</button>
                      <button type="button" onClick={() => startTransition(() => void toggleModel(model))} className="rounded-full border border-white/60 bg-white/40 px-6 py-3 text-[13px] font-bold text-[var(--muted)] transition-all duration-300 hover:bg-white hover:border-amber-400 hover:text-amber-600 hover:shadow-md active:scale-95 backdrop-blur-sm">{model.enabled ? "停用" : "启用"}</button>
                      <button type="button" onClick={() => startTransition(() => void removeModel(model))} className="rounded-full border border-red-200/50 bg-red-50/50 px-6 py-3 text-[13px] font-bold text-red-500 transition-all duration-300 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-md active:scale-95">删除</button>
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[2.5rem] border border-white/40 bg-white/30 px-6 py-6 sm:px-8 sm:py-8 backdrop-blur-md transition-colors duration-500 hover:bg-white/40">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                        <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">接入详情</span>
                      </div>
                      <div className="mt-6 grid gap-6 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-widest">模型 ID</p>
                          <p className="mt-2 break-all font-mono text-[14px] font-bold text-[var(--foreground)]">{model.modelName || "未填写"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-widest">Base URL</p>
                          <p className="mt-2 break-all font-mono text-[13px] font-bold text-[var(--foreground)] leading-relaxed">{model.baseUrl}</p>
                        </div>
                      </div>
                      <div className="mt-8 border-t border-black/5 pt-5">
                        <p className="text-[11px] font-bold tracking-wide text-[var(--muted)] opacity-50 uppercase">更新于 {formatDate(model.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col rounded-[2.5rem] border border-white/40 bg-white/30 px-6 py-6 sm:px-8 sm:py-8 backdrop-blur-md transition-colors duration-500 hover:bg-white/40">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${model.lastConnectionTest?.status === "success" ? "bg-emerald-500 text-emerald-500" : model.lastConnectionTest ? "bg-red-500 text-red-500" : "bg-[var(--muted)] text-[var(--muted)]"}`} />
                        <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--muted)] uppercase">诊断报告</span>
                      </div>
                      <div className="mt-6 flex-1">
                        <p className="text-[14px] font-medium leading-[1.8] text-[var(--foreground)]">{formatModelTestMessage(model.lastConnectionTest)}</p>
                      </div>
                      {model.lastConnectionTest ? (
                        <div className="mt-8 border-t border-black/5 pt-5">
                          <p className="text-[11px] font-bold tracking-wide text-[var(--muted)] opacity-50 uppercase">测试于 {formatDate(model.lastConnectionTest.testedAt)}</p>
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
