"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  ensureLocalMockModels,
  fetchJson,
  getProviderChineseLabel,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
  reorderIds,
  supportsLocalMockTools,
} from "@/lib/client/chat-lab-client";
import type { ModelView, ProviderType, RoomType, RoomView } from "@/types/app";

export function CreateRoomPage() {
  const router = useRouter();
  const mockToolsEnabled = supportsLocalMockTools();
  const [models, setModels] = useState<ModelView[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderType | "ALL">("ALL");
  const [roomForm, setRoomForm] = useState({
    title: "",
    type: "GROUP" as RoomType,
    modelIds: [] as string[],
  });

  async function loadModels() {
    const data = await fetchJson<{ models: ModelView[] }>("/api/models");
    setModels(data.models.filter((model) => model.enabled));
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      await loadModels();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "加载模型失败。");
    } finally {
      setBusy(false);
    }
  });

  useEffect(() => {
    startTransition(() => {
      void handleInitialLoad();
    });
  }, []);

  const selectedModels = useMemo(
    () =>
      roomForm.modelIds
        .map((modelId) => models.find((model) => model.id === modelId))
        .filter((model): model is ModelView => Boolean(model)),
    [models, roomForm.modelIds],
  );

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

  const canCreateRoom =
    roomForm.type === "SINGLE" ? selectedModels.length === 1 : selectedModels.length >= 2;

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  function toggleModel(modelId: string) {
    setRoomForm((current) => {
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

  function clearSelection() {
    setRoomForm((current) => ({ ...current, modelIds: [] }));
    clearDragState();
  }

  function removeSelectedModel(modelId: string) {
    setRoomForm((current) => ({ ...current, modelIds: current.modelIds.filter((id) => id !== modelId) }));
    clearDragState();
  }

  function previewSelectedModelMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) return;
    setRoomForm((current) => {
      const nextModelIds = reorderIds(current.modelIds, draggedModelId, targetId);
      return nextModelIds.join(",") === current.modelIds.join(",")
        ? current
        : { ...current, modelIds: nextModelIds };
    });
    setDragOverModelId(targetId);
  }

  async function createLocalMockModels() {
    setBusy(true);
    setErrorMessage("");
    try {
      const mockModels = await ensureLocalMockModels();
      await loadModels();
      setRoomForm({
        title: "本地测试群聊",
        type: "GROUP",
        modelIds: mockModels.map((model) => model.id),
      });
      setNotice("本地测试模型已加入。");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "加载本地测试模型失败。");
    } finally {
      setBusy(false);
    }
  }

  async function submitRoomForm() {
    if (!canCreateRoom) {
      setErrorMessage(roomForm.type === "SINGLE" ? "单聊需要且只能选择 1 个模型。" : "群聊至少需要 2 个模型。");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      const title = roomForm.title.trim() || (roomForm.type === "SINGLE" ? "新的单聊房间" : "新的群聊房间");
      const data = await fetchJson<{ room: RoomView }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ title, type: roomForm.type, modelIds: roomForm.modelIds }),
      });
      router.push(`/rooms/${data.room.id}`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "创建房间失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
      {/* ─ Page header ─ */}
      <section className="ly-page-header">
        <div className="ly-page-heading">
          <h1 className="ly-page-title">新建房间</h1>
          <p className="ly-page-subtitle">
            挑选模型，定义回答顺序，创建多模型协作房间。
          </p>
        </div>
        <div className="ly-page-actions">
          <Link href="/rooms" className="ly-page-action ly-secondary-action px-4 py-2 text-[13px] font-bold active:scale-95">
            返回列表
          </Link>
          {mockToolsEnabled && (
            <button type="button" onClick={() => startTransition(() => void createLocalMockModels())} disabled={busy} className="ly-page-action rounded-xl border border-sky-200/50 bg-sky-50/50 px-4 py-2 text-[13px] font-bold text-sky-700 transition hover:bg-sky-50 active:scale-95 disabled:opacity-50">
              加载测试模型
            </button>
          )}
        </div>
      </section>

      {/* ─ Room config ─ */}
      <section className="ly-glass ly-panel-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">房间名称</label>
            <input value={roomForm.title} onChange={(e) => setRoomForm((c) => ({ ...c, title: e.target.value }))} className="ly-control" placeholder="例如：产品评审小组" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">房间类型</label>
            <select value={roomForm.type} onChange={(e) => { const t = e.target.value as RoomType; setRoomForm((c) => ({ ...c, type: t, modelIds: t === "SINGLE" ? c.modelIds.slice(0, 1) : c.modelIds })); clearDragState(); }} className="ly-control appearance-none cursor-pointer">
              <option value="GROUP">群聊 (多模型顺序协作)</option>
              <option value="SINGLE">单聊 (单模型快速对话)</option>
            </select>
          </div>
        </div>
        {(notice || busy) && (
          <p className="mt-3 text-[12px] font-medium text-[var(--accent)]">{busy ? "正在同步模型状态..." : notice}</p>
        )}
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-red-200/50 bg-red-50/80 px-4 py-3 text-[13px] font-bold text-red-600">
          提示：{errorMessage}
        </div>
      )}

      {/* ─ Model selection + ordering ─ */}
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left: model library */}
        <div className="ly-glass ly-panel-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-display font-bold tracking-tight">挑选参与成员</h2>
            {selectedModels.length > 0 && (
              <button type="button" onClick={clearSelection} className="rounded-lg border border-white/60 bg-white/30 px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] transition hover:border-red-200 hover:text-red-500">
                清空已选
              </button>
            )}
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

          <div className="mt-4 space-y-2">
            {filteredModels.length === 0 ? (
              <div className="ly-empty-card px-5 py-8 text-center text-[13px] font-medium text-[var(--muted)]">
                没有找到匹配的模型
              </div>
            ) : (
              filteredModels.map((model) => {
                const selected = roomForm.modelIds.includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    className={`ly-list-item group flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left duration-300 hover:-translate-y-0.5 ${
                      selected
                        ? "border-[var(--accent)]/50 bg-[var(--accent)] shadow-md shadow-[var(--accent)]/20"
                        : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-[9px] font-bold tracking-wide shadow-sm transition-transform group-hover:scale-105 ${selected ? "bg-white/20 text-white" : getProviderIconClassName(model.provider)}`}>
                        {getProviderShortName(model.provider)}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[14px] font-display font-bold tracking-tight ${selected ? "text-white" : ""}`}>{model.name}</p>
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
              {roomForm.type === "SINGLE" ? "单聊模式，只保留 1 个模型。" : "群聊模式，拖拽调整回答顺序。"}
            </p>

            <div className="mt-5 space-y-2">
              {selectedModels.length === 0 ? (
                <div className="ly-empty-card px-5 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--foreground)]/5 text-lg font-bold text-[var(--foreground)]/25">→</div>
                  <p className="mt-3 text-[13px] font-bold text-[var(--muted)] opacity-70">从左侧挑选模型</p>
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
                        draggable={roomForm.type === "GROUP"}
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
                        } ${roomForm.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white shadow-sm relative z-10">
                              {index + 1}
                            </span>
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-[9px] font-bold tracking-wide shadow-sm ${getProviderIconClassName(model.provider)}`}>
                              {getProviderShortName(model.provider)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[14px] font-display font-bold tracking-tight">{model.name}</p>
                              <p className="text-[10px] font-bold tracking-wider text-[var(--muted)] opacity-60 uppercase">{getProviderChineseLabel(model.provider)}</p>
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
                onClick={() => startTransition(() => void submitRoomForm())}
                disabled={!canCreateRoom || busy}
                className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 text-[15px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? "正在创建..." : "完成并进入房间"}
              </button>

              <div className="flex items-center justify-center gap-4">
                <Link href="/rooms" className="text-[12px] font-bold text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                  返回房间列表
                </Link>
                <span className="h-1 w-1 rounded-full bg-[var(--border)]" />
              <button type="button" onClick={clearSelection} className="text-[12px] font-bold text-[var(--muted)] hover:text-red-500 transition-colors">
                  重置所有挑选
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
