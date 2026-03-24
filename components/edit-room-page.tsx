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
    if (!room) return false;
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
      setNotice("房间配置已保存。");
      router.push(`/rooms/${roomId}`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
      {/* ─ Page header ─ */}
      <section className="ly-page-header">
        <div className="ly-page-heading">
          <h1 className="ly-page-title">
            编辑房间{room ? ` — ${room.title}` : ""}
          </h1>
          <p className="ly-page-subtitle">
            增减成员或调整顺序，改动从下一轮回答生效，不影响历史记录。
          </p>
        </div>
        <div className="ly-page-actions">
          <Link href={`/rooms/${roomId}`} className="ly-page-action rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-[var(--accent)]/20 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95">
            返回聊天
          </Link>
          <button type="button" onClick={resetForm} disabled={!dirty || activeAction !== null} className="ly-page-action ly-secondary-action px-4 py-2 text-[13px] font-bold active:scale-95 disabled:opacity-40">
            撤销修改
          </button>
          <Link href="/rooms" className="ly-page-action ly-secondary-action px-4 py-2 text-[13px] font-bold active:scale-95">
            房间列表
          </Link>
        </div>
      </section>

      {/* ─ Room config ─ */}
      <section className="ly-glass ly-panel-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">房间名称</label>
            <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} className="ly-control" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">房间类型</label>
            <select value={form.type} onChange={(e) => { const t = e.target.value as RoomType; setForm((c) => ({ ...c, type: t, modelIds: t === "SINGLE" ? c.modelIds.slice(0, 1) : c.modelIds })); clearDragState(); }} className="ly-control appearance-none cursor-pointer">
              <option value="GROUP">群聊 (顺序协作)</option>
              <option value="SINGLE">单聊 (单模型对话)</option>
            </select>
          </div>
        </div>
        {(notice || activeAction) && (
          <p className="mt-3 text-[12px] font-medium text-[var(--accent)]">
            {activeAction === "loading" ? "正在读取配置..." : activeAction === "saving" ? "正在保存..." : notice}
          </p>
        )}
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      {disabledSelectedModels.length > 0 && (
        <div className="rounded-xl border border-red-200/50 bg-red-50/80 px-4 py-3 text-[13px] font-bold text-red-600 animate-pulse">
          ⚠ 流水线中有已停用的模型，请先处理。
        </div>
      )}

      {/* ─ Model selection + ordering ─ */}
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left: model library */}
        <div className="ly-glass ly-panel-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-display font-bold tracking-tight">挑选成员</h2>
            <span className="rounded-md bg-white/30 border border-white/60 px-2.5 py-1 text-[11px] font-bold text-[var(--muted)]">已选 {selectedModels.length}</span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索模型..." className="ly-control ly-control-sm flex-1" />
            <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as ProviderType | "ALL")} className="ly-control ly-control-sm appearance-none cursor-pointer px-3 font-bold">
              <option value="ALL">全部厂商</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>{getProviderOptionLabel(p)}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {filteredModels.length === 0 ? (
              <div className="ly-empty-card px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)]">
                未找到可用模型
              </div>
            ) : (
              filteredModels.map((model) => {
                const selected = form.modelIds.includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    className={`ly-list-item group flex w-full items-center justify-between gap-4 px-4 py-3 text-left duration-300 hover:-translate-y-0.5 ${
                      selected
                        ? "border-[var(--accent)]/50 bg-[var(--accent)] shadow-md shadow-[var(--accent)]/20"
                        : "hover:shadow-md"
                    } ${!model.enabled && !selected ? "opacity-50 grayscale hover:grayscale-0 hover:opacity-80" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm transition-transform group-hover:scale-105 ${selected ? "bg-white/20 text-white" : getProviderIconClassName(model.provider)}`}>
                        {getProviderShortName(model.provider)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[14px] font-display font-bold tracking-tight ${selected ? "text-white" : ""}`}>{model.name}</p>
                          {!model.enabled && <span className="rounded-md bg-red-100/80 border border-red-200 px-1.5 py-0.5 text-[8px] font-bold text-red-600">已停用</span>}
                        </div>
                        <p className={`mt-0.5 text-[11px] font-medium truncate ${selected ? "text-white/80" : "text-[var(--muted)]"}`}>{model.modelName}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${selected ? "bg-white/20 text-white" : "ly-mini-action border-white/60 bg-white/30 text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]"}`}>
                      {selected ? "已选" : "加入"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: ordering + submit */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="ly-glass ly-panel-card">
            <h2 className="text-lg font-display font-bold tracking-tight">发言顺序</h2>
            <p className="mt-1 text-[12px] font-medium text-[var(--muted)]">
              {form.type === "SINGLE" ? "单聊模式，只保留 1 个模型。" : "群聊模式，拖拽调整回答顺序。"}
            </p>

            <div className="mt-5 space-y-2">
              {selectedModels.length === 0 ? (
                <div className="ly-empty-card px-5 py-10 text-center">
                  <p className="text-[13px] font-bold text-[var(--muted)] opacity-70">从左侧挑选模型</p>
                </div>
              ) : (
                selectedModels.map((model, index) => {
                  const isDragging = draggedModelId === model.id;
                  const isDropTarget = dragOverModelId === model.id && draggedModelId !== model.id;
                  const isLast = index === selectedModels.length - 1;

                  return (
                    <div key={model.id} className="relative">
                      {!isLast && selectedModels.length > 1 && (
                        <div className="absolute left-[28px] top-12 bottom-[-0.75rem] w-0.5 bg-[var(--accent)]/20 rounded-full" />
                      )}
                      <div
                        draggable={form.type === "GROUP"}
                        onDragStart={(e) => {
                          setDraggedModelId(model.id);
                          setDragOverModelId(model.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", model.id);
                        }}
                        onDragEnter={() => previewSelectedModelMove(model.id)}
                        onDragOver={(e) => { e.preventDefault(); previewSelectedModelMove(model.id); }}
                        onDrop={(e) => { e.preventDefault(); clearDragState(); }}
                        onDragEnd={clearDragState}
                        className={`ly-list-item relative z-10 px-4 py-3.5 duration-300 ${
                          isDragging
                            ? "scale-[1.03] border-[var(--accent)] bg-white/95 shadow-lg z-20"
                          : isDropTarget
                              ? "border-[var(--accent)] bg-[var(--accent)]/5 translate-x-2"
                              : "hover:bg-white/60"
                        } ${!model.enabled ? "border-red-200/50 bg-red-50/50" : ""} ${form.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shadow-sm relative z-10 ${!model.enabled ? "bg-red-500 text-white" : "bg-[var(--accent)] text-white"}`}>
                              {index + 1}
                            </span>
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm ${!model.enabled ? "bg-white text-red-500 opacity-60" : getProviderIconClassName(model.provider)}`}>
                              {getProviderShortName(model.provider)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-[14px] font-display font-bold tracking-tight ${!model.enabled ? "text-red-700" : ""}`}>{model.name}</p>
                                {!model.enabled && <span className="rounded-md bg-red-100/80 border border-red-200 px-1.5 py-0.5 text-[8px] font-bold text-red-600">已停用</span>}
                              </div>
                              <p className={`text-[10px] font-bold tracking-wider uppercase opacity-60 ${!model.enabled ? "text-red-500" : "text-[var(--muted)]"}`}>{getProviderChineseLabel(model.provider)}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeSelectedModel(model.id)} className="ly-mini-action rounded-lg p-2 text-[var(--muted)] opacity-70 hover:border-red-200 hover:bg-red-50 hover:text-red-500">
                            <span className="text-[11px] font-bold">移除</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => startTransition(() => void saveConfiguration())}
                disabled={!dirty || !countValid || disabledSelectedModels.length > 0 || activeAction !== null}
                className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 text-[15px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {activeAction === "saving" ? "正在保存..." : "保存并更新"}
              </button>
              {!dirty && (
                <p className="text-center text-[11px] font-bold text-[var(--muted)] opacity-50 uppercase tracking-wider">
                  未检测到变更
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
