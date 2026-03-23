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
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-7 py-9 sm:px-10 sm:py-12">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.24em] text-white/80 uppercase">
              流水线维护
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl xl:leading-[1.1]">
              调整你的 AI <br />
              <span className="text-white/60">协作链路</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-lg">
              正在编辑房间 {room?.title ? `「${room.title}」` : "配置"}。
              你可以随时增减成员或调整顺序，这些改动会从下一轮回答开始生效，不影响历史记录。
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <p className="text-sm font-bold text-white/90">无损重构</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">仅改变后续协作逻辑，完整保留过往聊天上下文。</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <p className="text-sm font-bold text-white/90">状态检查</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">自动标记已停用模型，确保链路各环节依然可用。</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <p className="text-sm font-bold text-white/90">即时同步</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">保存后自动刷新，即刻回到聊天页继续协作。</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-500 opacity-10 blur-[100px]" />
        </div>

        <div className="ly-glass flex flex-col rounded-[2.8rem] p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">状态反馈</p>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">操作与快速导航</h2>
          <div className="mt-8 grid flex-1 gap-4">
            <Link href={`/rooms/${roomId}`} className="group flex items-center justify-between rounded-[2rem] bg-[var(--accent)] px-7 py-5 text-lg font-bold text-white transition-all hover:bg-[var(--accent-strong)] hover:shadow-[0_20px_40px_rgba(195,90,47,0.2)] active:scale-95">
              <span>返回聊天页</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <button type="button" onClick={resetForm} disabled={!dirty || activeAction !== null} className="flex items-center justify-between rounded-[2rem] border border-[var(--border)] bg-white/80 px-7 py-5 text-left font-bold transition-all hover:bg-white active:scale-95 disabled:opacity-40">
              <span>撤销未保存修改</span>
              <span className="text-[var(--muted)] opacity-30 text-xs">UNDO CHANGES</span>
            </button>
            <Link href="/rooms" className="flex items-center justify-between rounded-[2rem] border border-[var(--border)] bg-white/80 px-7 py-5 text-left font-bold transition-all hover:bg-white active:scale-95">
              <span>返回房间列表</span>
              <span className="text-[var(--muted)] opacity-30 text-xs">LIST</span>
            </Link>
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-black/5 px-5 py-4 text-sm text-[var(--muted)]">
            <p className="leading-relaxed">
              {activeAction === "loading" ? "正在读取现有配置..." : activeAction === "saving" ? "正在提交变更..." : notice || "你可以随时更改房间标题或调整模型顺序。"}
            </p>
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="ly-glass rounded-[2.6rem] p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">配置工作台</p>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">房间与成员信息</h2>

          <div className="mt-8 space-y-6">
            <div className="space-y-2.5">
              <label className="text-[13px] font-bold text-[var(--muted)] ml-1">房间名称</label>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/5" />
            </div>
            <div className="space-y-2.5">
              <label className="text-[13px] font-bold text-[var(--muted)] ml-1">房间类型</label>
              <select value={form.type} onChange={(event) => { const nextType = event.target.value as RoomType; setForm((current) => ({ ...current, type: nextType, modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds })); clearDragState(); }} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)]">
                <option value="GROUP">群聊 (顺序协作)</option>
                <option value="SINGLE">单聊 (单模型对话)</option>
              </select>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] font-bold text-[var(--muted)] ml-1 uppercase tracking-wider">从库中挑选成员</p>
                <div className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-bold text-[var(--muted)]">已选 {selectedModels.length}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型库..." className="rounded-xl border border-[var(--border)] bg-white/92 px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]" />
                <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="rounded-xl border border-[var(--border)] bg-white/92 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-[var(--accent)]">
                  <option value="ALL">全部厂商</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {getProviderOptionLabel(provider)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-none">
                {filteredModels.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">未找到可用模型成员</div>
                ) : (
                  filteredModels.map((model) => {
                    const selected = form.modelIds.includes(model.id);

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => toggleModel(model.id)}
                        className={`group flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
                          selected ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-lg" : "border-[var(--border)] bg-white/80 hover:border-[var(--accent)]"
                        } ${!model.enabled && !selected ? "opacity-50 grayscale" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-[9px] font-bold tracking-[0.2em] shadow-sm ${selected ? "bg-white/20 text-white" : getProviderIconClassName(model.provider)}`}>
                            {getProviderShortName(model.provider)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold tracking-tight text-[14px]">{model.name}</p>
                              {!model.enabled && <span className="rounded-full bg-red-100 text-red-600 px-1.5 py-0.5 text-[9px] font-bold">已停用</span>}
                            </div>
                            <p className={`text-[10px] font-medium opacity-60 truncate ${selected ? "text-white" : "text-[var(--muted)]"}`}>{model.modelName}</p>
                          </div>
                        </div>
                        {selected ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20">鉁</span>
                        ) : (
                          <span className="rounded-lg border border-[var(--border)] bg-white px-3 py-1 text-[10px] font-bold text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">加入</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className="ly-glass rounded-[2.6rem] p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">流水线编排</p>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">发言顺序状态</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {form.type === "SINGLE" ? "当前为单聊模式，建议只保留最核心的模型。" : "群聊模式下，你可以自由拖拽定义这一组成员的协作流水线。"}
            </p>

            {disabledSelectedModels.length > 0 && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-bold text-red-600 animate-pulse">
                鈯 注意：流水线中有已停用的模型，请先处理。
              </div>
            )}

            <div className="mt-8 space-y-4">
              {selectedModels.length === 0 ? (
                <div className="rounded-[2.2rem] border border-dashed border-[var(--border)] bg-white/40 px-6 py-12 text-center">
                  <p className="text-sm font-bold text-[var(--muted)] opacity-60">请从左侧挑选模型成员加入链路</p>
                </div>
              ) : (
                selectedModels.map((model, index) => {
                  const isDragging = draggedModelId === model.id;
                  const isDropTarget = dragOverModelId === model.id && draggedModelId !== model.id;
                  const isLast = index === selectedModels.length - 1;

                  return (
                    <div key={model.id} className="relative">
                      {!isLast && selectedModels.length > 1 && (
                        <div className="absolute left-[35px] top-12 bottom-[-1.5rem] w-0.5 bg-gradient-to-b from-[var(--border)] to-transparent" />
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
                        className={`relative z-10 rounded-[2rem] border px-5 py-5 transition-all duration-300 ${
                          isDragging
                            ? "scale-[1.05] border-[var(--accent)] bg-white shadow-2xl z-20"
                            : isDropTarget
                              ? "border-[var(--accent)] bg-[rgba(195,90,47,0.08)] translate-x-2"
                              : "border-[var(--border)] bg-white/90 hover:shadow-lg"
                        } ${!model.enabled ? "border-red-200 bg-red-50/30" : ""} ${form.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(248,246,242)] border border-[var(--border)] text-xs font-bold text-[var(--muted)]">
                              {index + 1}
                            </span>
                            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[10px] font-bold tracking-[0.2em] shadow-sm ${getProviderIconClassName(model.provider)}`}>
                              {getProviderShortName(model.provider)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold tracking-tight">{model.name}</p>
                                {!model.enabled && <span className="text-[9px] font-bold text-red-500 uppercase">Disabled</span>}
                              </div>
                              <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase">{getProviderChineseLabel(model.provider)}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeSelectedModel(model.id)} className="rounded-xl p-2 text-[var(--muted)] hover:bg-red-50 hover:text-red-500 transition-colors">
                            <span className="text-lg">鈹</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-10 space-y-4">
              <button
                type="button"
                onClick={() => startTransition(() => void saveConfiguration())}
                disabled={!dirty || !countValid || disabledSelectedModels.length > 0 || activeAction !== null}
                className="w-full rounded-[2rem] bg-[var(--accent)] px-6 py-5 text-lg font-bold text-white shadow-xl shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0"
              >
                {activeAction === "saving" ? "正在应用变更..." : "保存并更新流水线"}
              </button>
              
              {!dirty && (
                <p className="text-center text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-widest italic">
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
