"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  describeClientError,
  fetchJson,
  getProviderChineseLabel,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
  reorderIds,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import type { ModelView, ProviderType, RoomType, RoomView } from "@/types/app";

interface EditRoomPageProps {
  roomId: string;
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

export function EditRoomPage({ roomId }: EditRoomPageProps) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [models, setModels] = useState<ModelView[]>([]);
  const [activeAction, setActiveAction] = useState<"loading" | "saving" | null>(null);
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderType | "ALL">("ALL");
  const [form, setForm] = useState({
    title: "",
    type: "GROUP" as RoomType,
    modelIds: [] as string[],
  });

  async function loadModels() {
    const data = await fetchJson<{ models: ModelView[] }>("/api/models");
    setModels(data.models);
  }

  async function loadRoom() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    setRoom(data.room);
    setForm({
      title: data.room.title,
      type: data.room.type,
      modelIds: data.room.roomModels.map((item) => item.modelId),
    });
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await Promise.all([loadModels(), loadRoom()]);
      setNotice("房间配置已加载完成。");
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
  }, [roomId]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return models.filter((model) => {
      const matchesProvider = providerFilter === "ALL" || model.provider === providerFilter;
      const matchesQuery =
        query.length === 0 ||
        [model.name, model.modelName, getProviderOptionLabel(model.provider)].join(" ").toLowerCase().includes(query);
      return matchesProvider && matchesQuery;
    });
  }, [models, providerFilter, searchQuery]);

  const selectedModels = useMemo(
    () =>
      form.modelIds
        .map((modelId) => models.find((model) => model.id === modelId))
        .filter((model): model is ModelView => Boolean(model)),
    [form.modelIds, models],
  );

  const disabledSelectedModels = useMemo(
    () => selectedModels.filter((model) => !model.enabled),
    [selectedModels],
  );

  const countValid = form.type === "SINGLE" ? selectedModels.length === 1 : selectedModels.length >= 2;
  const dirty = useMemo(() => {
    if (!room) {
      return false;
    }

    return (
      room.title !== form.title.trim() ||
      room.type !== form.type ||
      room.roomModels.map((item) => item.modelId).join(",") !== form.modelIds.join(",")
    );
  }, [form, room]);

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  function resetForm() {
    if (!room) return;

    setForm({
      title: room.title,
      type: room.type,
      modelIds: room.roomModels.map((item) => item.modelId),
    });
    clearDragState();
    setFeedback(null);
  }

  function toggleModel(modelId: string) {
    const model = models.find((item) => item.id === modelId);
    if (!model) return;

    if (!model.enabled && !form.modelIds.includes(modelId)) {
      setFeedback({
        title: "这个模型当前已停用",
        description: `${model.name} 目前不能加入房间，因为它在模型管理页被停用了。`,
        suggestion: "请先去模型管理页重新启用它，或者改选别的可用模型。",
        tone: "warning",
      });
      return;
    }

    setForm((current) => {
      const exists = current.modelIds.includes(modelId);

      if (current.type === "SINGLE") {
        return { ...current, modelIds: exists ? [] : [modelId] };
      }

      return {
        ...current,
        modelIds: exists ? current.modelIds.filter((id) => id !== modelId) : [...current.modelIds, modelId],
      };
    });
  }

  function removeSelectedModel(modelId: string) {
    setForm((current) => ({ ...current, modelIds: current.modelIds.filter((id) => id !== modelId) }));
    clearDragState();
  }

  function previewSelectedModelMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) return;

    setForm((current) => {
      const nextModelIds = reorderIds(current.modelIds, draggedModelId, targetId);
      return nextModelIds.join(",") === current.modelIds.join(",")
        ? current
        : { ...current, modelIds: nextModelIds };
    });
    setDragOverModelId(targetId);
  }

  async function saveConfiguration() {
    setActiveAction("saving");
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}/configuration`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          modelIds: form.modelIds,
        }),
      });

      setRoom(data.room);
      setForm({
        title: data.room.title,
        type: data.room.type,
        modelIds: data.room.roomModels.map((item) => item.modelId),
      });
      setNotice("房间配置已保存，新的顺序会从下一轮对话开始生效。");
      router.push(`/rooms/${roomId}`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="ly-shell flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[3.5rem] px-8 py-10 sm:px-12 sm:py-14 shadow-2xl">
          <div className="relative z-10 animate-fade-in-up">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.24em] text-white/90 uppercase backdrop-blur-md shadow-inner">
              流水线维护
            </span>
            <h1 className="mt-8 text-5xl font-display font-bold tracking-tight sm:text-6xl xl:text-[4.5rem] xl:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60">
              调整你的 AI <br />
              <span className="text-white/40 font-light">协作链路</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[1.0625rem] font-medium leading-[1.8] text-white/70">
              正在编辑房间 {room?.title ? `「${room.title}」` : "配置"}。
              你可以随时增减成员或调整顺序，这些改动会从下一轮回答开始生效，不影响历史记录。
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[14px] font-bold text-white/90">无损重构</p>
                <p className="mt-2 text-[12px] font-medium text-white/50 leading-relaxed">仅改变后续协作逻辑，完整保留过往聊天上下文。</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[14px] font-bold text-white/90">状态检查</p>
                <p className="mt-2 text-[12px] font-medium text-white/50 leading-relaxed">自动标记已停用模型，确保链路各环节依然可用。</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[14px] font-bold text-white/90">即时同步</p>
                <p className="mt-2 text-[12px] font-medium text-white/50 leading-relaxed">保存后自动刷新，即刻回到聊天页继续协作。</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-15 blur-[120px] animate-pulse-slow" />
        </div>

        <div className="ly-glass flex flex-col rounded-[3.5rem] p-8 sm:p-10 shadow-xl shadow-[var(--accent)]/5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">状态反馈</p>
          </div>
          <h2 className="mt-5 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">操作与快速导航</h2>
          <div className="mt-10 grid flex-1 gap-5">
            <Link href={`/rooms/${roomId}`} className="group relative flex items-center justify-between rounded-[2rem] bg-[linear-gradient(135deg,#993c50,#c7576f)] px-8 py-6 text-lg font-display font-bold text-white transition-all duration-500 hover:shadow-[0_24px_48px_rgba(153,60,80,0.3)] hover:-translate-y-1 active:scale-[0.98] overflow-hidden">
              <span className="relative z-10">返回聊天页</span>
              <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-2">→</span>
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
            </Link>
            <button type="button" onClick={resetForm} disabled={!dirty || activeAction !== null} className="flex items-center justify-between rounded-[2rem] border border-white/40 bg-white/30 px-8 py-6 text-left font-bold transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md disabled:opacity-40 disabled:hover:bg-white/30 disabled:hover:border-white/40">
              <span className="text-[15px] text-[var(--foreground)]">撤销未保存修改</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-50 uppercase">撤销修改</span>
            </button>
            <Link href="/rooms" className="flex items-center justify-between rounded-[2rem] border border-white/40 bg-white/30 px-8 py-6 text-left font-bold transition-all duration-300 hover:bg-white/60 hover:border-white/80 active:scale-[0.98] backdrop-blur-md">
              <span className="text-[15px] text-[var(--foreground)]">返回房间列表</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-50 uppercase">返回列表</span>
            </Link>
          </div>
          <div className="mt-8 flex items-start gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white/40 px-6 py-5 text-[14px] text-[var(--muted)] backdrop-blur-sm transition-colors hover:bg-white/60">
            <span className="mt-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">提示</span>
            <p className="leading-relaxed font-medium">
              {activeAction === "loading" ? "正在读取现有配置..." : activeAction === "saving" ? "正在提交变更..." : notice || "你可以随时更改房间标题或调整模型顺序。"}
            </p>
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-lg shadow-black/5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">配置工作台</p>
          </div>
          <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">房间与成员信息</h2>

          <div className="mt-10 space-y-7">
            <div className="space-y-3">
              <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">房间名称</label>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner" />
            </div>
            <div className="space-y-3">
              <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">房间类型</label>
              <select value={form.type} onChange={(event) => { const nextType = event.target.value as RoomType; setForm((current) => ({ ...current, type: nextType, modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds })); clearDragState(); }} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md shadow-inner appearance-none cursor-pointer">
                <option value="GROUP">群聊 (顺序协作)</option>
                <option value="SINGLE">单聊 (单模型对话)</option>
              </select>
            </div>

            <div className="pt-6 space-y-5 border-t border-[var(--border)]/50">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] font-bold text-[var(--foreground)] ml-2 uppercase tracking-widest">从库中挑选成员</p>
                <div className="rounded-full bg-white/50 border border-white/60 px-4 py-1.5 text-[11px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm">已选 {selectedModels.length}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold opacity-40 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all duration-300">搜索</span>
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型库..." className="w-full rounded-[1.25rem] border border-white/40 bg-white/50 pl-12 pr-5 py-3.5 text-[14px] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner" />
                </div>
                <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="w-full rounded-[1.25rem] border border-white/40 bg-white/50 px-5 py-3.5 text-[14px] font-bold text-[var(--foreground)] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md appearance-none shadow-sm cursor-pointer">
                  <option value="ALL">全部厂商</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {getProviderOptionLabel(provider)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-none rounded-[1.5rem] bg-white/10 p-2 border border-white/20 shadow-inner">
                {filteredModels.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-white/60 bg-white/30 p-10 text-center text-[14px] font-medium text-[var(--muted)] backdrop-blur-sm">未找到可用模型成员</div>
                ) : (
                  filteredModels.map((model) => {
                    const selected = form.modelIds.includes(model.id);

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => toggleModel(model.id)}
                        className={`group flex w-full items-center justify-between gap-4 rounded-[1.25rem] border px-5 py-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                          selected ? "border-[var(--accent)]/50 bg-[linear-gradient(135deg,rgba(153,60,80,0.8),rgba(199,87,111,0.8))] shadow-md shadow-[var(--accent)]/20 backdrop-blur-md" : "border-white/40 bg-white/40 hover:bg-white/70 hover:shadow-[0_8px_24px_rgba(47,46,51,0.05)] backdrop-blur-md"
                        } ${!model.enabled && !selected ? "opacity-50 grayscale hover:grayscale-0 hover:opacity-80" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[1rem] text-[10px] font-bold tracking-[0.2em] shadow-sm transition-transform duration-300 group-hover:scale-105 ${selected ? "bg-white/20 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]" : getProviderIconClassName(model.provider)}`}>
                            {getProviderShortName(model.provider)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <p className={`font-display font-bold tracking-tight text-[15px] ${selected ? "text-white" : "text-[var(--foreground)]"}`}>{model.name}</p>
                              {!model.enabled && <span className="rounded-full bg-red-100/80 border border-red-200 px-2 py-0.5 text-[9px] font-bold text-red-600 shadow-sm backdrop-blur-sm">已停用</span>}
                            </div>
                            <p className={`mt-1 text-[11px] font-medium tracking-wide opacity-80 truncate ${selected ? "text-white/80" : "text-[var(--muted)]"}`}>{model.modelName}</p>
                          </div>
                        </div>
                        {selected ? (
                          <span className="inline-flex h-8 items-center justify-center rounded-full bg-white/20 px-3 text-[11px] font-bold text-white shadow-inner backdrop-blur-md transition-transform duration-300 group-hover:scale-105">已选</span>
                        ) : (
                          <span className="rounded-full border border-white/60 bg-white/50 px-4 py-2 text-[11px] font-bold text-[var(--muted)] shadow-sm transition-colors duration-300 group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] group-hover:bg-white">加入</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <div className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-lg shadow-black/5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">流水线编排</p>
            </div>
            <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">发言顺序状态</h2>
            <p className="mt-3 text-[14px] font-medium leading-relaxed text-[var(--muted)] opacity-90">
              {form.type === "SINGLE" ? "当前为单聊模式，建议只保留最核心的模型。" : "群聊模式下，你可以自由拖拽定义这一组成员的协作流水线。"}
            </p>

            {disabledSelectedModels.length > 0 && (
              <div className="mt-8 rounded-[2rem] border border-red-200/50 bg-red-50/80 p-5 text-[14px] font-bold text-red-600 shadow-lg shadow-red-500/10 backdrop-blur-md animate-pulse">
                注意：流水线中有已停用的模型，请先处理。
              </div>
            )}

            <div className="mt-10 space-y-5">
              {selectedModels.length === 0 ? (
                <div className="rounded-[2.5rem] border border-dashed border-white/60 bg-white/20 px-8 py-16 text-center backdrop-blur-sm">
                  <p className="text-[15px] font-bold text-[var(--muted)] opacity-70">请从左侧挑选模型成员加入链路</p>
                </div>
              ) : (
                selectedModels.map((model, index) => {
                  const isDragging = draggedModelId === model.id;
                  const isDropTarget = dragOverModelId === model.id && draggedModelId !== model.id;
                  const isLast = index === selectedModels.length - 1;

                  return (
                    <div key={model.id} className="relative">
                      {!isLast && selectedModels.length > 1 && (
                        <div className="absolute left-[40px] top-14 bottom-[-1.5rem] w-1 bg-[linear-gradient(180deg,rgba(153,60,80,0.3),rgba(153,60,80,0.05))] rounded-full" />
                      )}
                      <div
                        draggable={form.type === "GROUP"}
                        onDragStart={(event) => {
                          setDraggedModelId(model.id);
                          setDragOverModelId(model.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", model.id);
                        }}
                        onDragEnter={() => previewSelectedModelMove(model.id)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          previewSelectedModelMove(model.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          clearDragState();
                        }}
                        onDragEnd={clearDragState}
                        className={`relative z-10 rounded-[2.5rem] border px-6 py-6 transition-all duration-300 ${
                          isDragging
                            ? "scale-[1.05] border-[var(--accent)] bg-[rgba(255,255,255,0.95)] shadow-2xl shadow-[var(--accent)]/10 ring-4 ring-[var(--accent)]/10 z-20"
                            : isDropTarget
                              ? "border-[var(--accent)] bg-[rgba(153,60,80,0.05)] translate-x-3 backdrop-blur-md"
                              : "border-white/50 bg-white/40 hover:bg-white/60 hover:shadow-[0_16px_40px_rgba(47,46,51,0.04)] backdrop-blur-md"
                        } ${!model.enabled ? "border-red-200/50 bg-red-50/50" : ""} ${form.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-5">
                          <div className="flex items-center gap-5">
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold shadow-md relative z-10 ${!model.enabled ? "bg-red-500 text-white shadow-red-500/20" : "bg-[linear-gradient(135deg,#f48498,#993c50)] text-white shadow-[var(--accent)]/20"}`}>
                              {index + 1}
                            </span>
                            <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.25rem] text-[11px] font-bold tracking-[0.2em] shadow-md ${!model.enabled ? "bg-white text-red-500 opacity-60" : getProviderIconClassName(model.provider)}`}>
                              {getProviderShortName(model.provider)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <p className={`text-[16px] font-display font-bold tracking-tight ${!model.enabled ? "text-red-700" : "text-[var(--foreground)]"}`}>{model.name}</p>
                                {!model.enabled && <span className="rounded-full bg-red-100/80 border border-red-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600 shadow-sm">已停用</span>}
                              </div>
                              <p className={`mt-1 text-[11px] font-bold tracking-widest uppercase opacity-60 ${!model.enabled ? "text-red-500" : "text-[var(--muted)]"}`}>{getProviderChineseLabel(model.provider)}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeSelectedModel(model.id)} className="rounded-2xl p-3 text-[var(--muted)] opacity-60 hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all duration-300">
                            <span className="text-sm font-bold">移除</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-12 space-y-5">
              <button
                type="button"
                onClick={() => startTransition(() => void saveConfiguration())}
                disabled={!dirty || !countValid || disabledSelectedModels.length > 0 || activeAction !== null}
                className="w-full relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#993c50,#c7576f)] px-8 py-6 text-[18px] font-display font-bold text-white shadow-[0_16px_32px_rgba(153,60,80,0.2)] transition-all duration-500 hover:shadow-[0_24px_48px_rgba(153,60,80,0.3)] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_16px_32px_rgba(153,60,80,0.2)] group"
              >
                <span className="relative z-10">{activeAction === "saving" ? "正在应用变更..." : "保存并更新流水线"}</span>
                {!disabledSelectedModels.length && dirty && countValid && activeAction === null && (
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                )}
              </button>
              
              {!dirty && (
                <p className="text-center text-[12px] font-bold text-[var(--muted)] opacity-50 uppercase tracking-widest italic pt-2">
                  未检测到任何变更
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
