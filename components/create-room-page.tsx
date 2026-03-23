"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  ensureLocalMockModels,
  fetchJson,
  formatReplyLength,
  getProviderBadgeClassName,
  getProviderChineseLabel,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
  reorderIds,
  supportsLocalMockTools,
  toRoomLabel,
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
      setNotice("可以开始配置新的顺序协作房间。");
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
    if (!draggedModelId || draggedModelId === targetId) {
      return;
    }

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
      setNotice("本地测试模型已经加入右侧顺序链路。");
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
        body: JSON.stringify({
          title,
          type: roomForm.type,
          modelIds: roomForm.modelIds,
        }),
      });
      router.push(`/rooms/${data.room.id}`);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "创建房间失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="ly-dark-panel ly-grid-lines rounded-[2.8rem] px-6 py-8 sm:px-8 sm:py-9">
          <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
            协作链路
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">把模型拖进一条清晰的协作链路里</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">
            左边负责定义房间身份和挑选模型，右边负责拖拽排序。这样建房过程不再像填表，而更像真正搭建一条多模型顺序工作流。
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">单聊与群聊共用同一套页面，切换时自动调整约束。</div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">右侧顺序区支持实时拖拽重排，所见即所得。</div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">本地 mock 和真实模型都能直接加入这条链路。</div>
          </div>
        </div>

        <div className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">房间概要</p>
          <h2 className="mt-3 text-3xl font-semibold">先定义房间，再定义发言顺序</h2>
          <div className="mt-6 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">房间名称</span>
              <input value={roomForm.title} onChange={(event) => setRoomForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]" placeholder="例如：产品评审群 / 深度分析组" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">房间类型</span>
              <select value={roomForm.type} onChange={(event) => { const nextType = event.target.value as RoomType; setRoomForm((current) => ({ ...current, type: nextType, modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds })); clearDragState(); }} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]">
                <option value="GROUP">群聊</option>
                <option value="SINGLE">单聊</option>
              </select>
            </label>
            {mockToolsEnabled ? (
              <button type="button" onClick={() => startTransition(() => void createLocalMockModels())} className="rounded-[1.4rem] border border-[var(--border)] bg-white/86 px-4 py-3 text-left text-sm font-medium transition hover:border-[var(--accent)]">
                一键加载本地测试模型
              </button>
            ) : null}
            <div className="rounded-[1.6rem] border border-[var(--border)] bg-white/78 px-4 py-4 text-sm text-[var(--muted)]">
              {busy ? "正在处理..." : notice || "先在左边选模型，再到右边拖拽它们的回答顺序。"}
            </div>
            {errorMessage ? <div className="rounded-[1.6rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{errorMessage}</div> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="ly-glass rounded-[2.5rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">模型库</p>
              <h2 className="mt-2 text-2xl font-semibold">从模型库中挑选参与者</h2>
            </div>
            {selectedModels.length > 0 ? (
              <button type="button" onClick={clearSelection} className="text-sm text-[var(--accent)]">
                清空已选
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型名称、模型 ID 或 Provider" className="rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]" />
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]">
              <option value="ALL">全部 Provider</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {getProviderOptionLabel(provider)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-[1.6rem] border border-[var(--border)] bg-white/78 px-4 py-3 text-sm text-[var(--muted)]">
            当前显示 {filteredModels.length} / {models.length} 个模型，已选择 {selectedModels.length} 个。
          </div>

          <div className="mt-5 grid gap-3">
            {filteredModels.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">当前筛选条件下没有可选模型。</div>
            ) : (
              filteredModels.map((model) => {
                const selected = roomForm.modelIds.includes(model.id);

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    className={`flex w-full items-start justify-between gap-4 rounded-[1.8rem] border px-4 py-4 text-left transition ${
                      selected ? "border-[var(--accent)] bg-[rgba(195,90,47,0.08)]" : "border-[var(--border)] bg-white/84 hover:border-[var(--accent)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(model.provider)}`}>
                        {getProviderShortName(model.provider)}
                      </span>
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{model.modelName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(model.provider)}`}>{getProviderChineseLabel(model.provider)}</span>
                          <span className="rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)}</span>
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">{selected ? "已加入" : "加入"}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <div className="ly-glass rounded-[2.5rem] p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">发言顺序</p>
            <h2 className="mt-2 text-2xl font-semibold">当前房间的发言顺序</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{toRoomLabel(roomForm.type)} 模式下，右侧顺序会成为后续回答的真实执行顺序。</p>

            <div className="mt-5 rounded-[1.6rem] border border-[var(--border)] bg-white/78 px-4 py-3 text-sm text-[var(--muted)]">
              {roomForm.type === "SINGLE" ? "单聊需要且只能有 1 个模型。" : "群聊至少需要 2 个模型，拖拽即可重排。"}
            </div>

            <div className="mt-5 grid gap-3">
              {selectedModels.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">左边选择模型后，它们会出现在这里。群聊模式下可以继续拖拽排序。</div>
              ) : (
                selectedModels.map((model, index) => {
                  const isDragging = draggedModelId === model.id;
                  const isDropTarget = dragOverModelId === model.id && draggedModelId !== model.id;

                  return (
                    <div
                      key={model.id}
                      draggable={roomForm.type === "GROUP"}
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
                      className={`rounded-[1.8rem] border px-4 py-4 transition ${
                        isDragging
                          ? "scale-[1.02] border-[var(--accent)] bg-[rgba(195,90,47,0.14)]"
                          : isDropTarget
                            ? "border-[var(--accent)] bg-[rgba(195,90,47,0.08)]"
                            : "border-[var(--border)] bg-white/84"
                      } ${roomForm.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(model.provider)}`}>
                            {getProviderShortName(model.provider)}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">{index + 1}</span>
                              <p className="font-medium">{model.name}</p>
                            </div>
                            <p className="mt-1 text-xs text-[var(--muted)]">{getProviderChineseLabel(model.provider)}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeSelectedModel(model.id)} className="rounded-full border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50">
                          移除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => startTransition(() => void submitRoomForm())}
              disabled={!canCreateRoom || busy}
              className="mt-6 w-full rounded-[1.6rem] bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              创建房间并进入聊天
            </button>

            <Link href="/rooms" className="mt-3 inline-flex text-sm text-[var(--muted)] hover:text-[var(--accent)]">
              返回房间列表
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
