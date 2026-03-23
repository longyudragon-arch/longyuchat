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
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-7 py-9 sm:px-10 sm:py-12">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.24em] text-white/80 uppercase">
              协作编排
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl xl:leading-[1.1]">
              搭建你的 AI <br />
              <span className="text-white/60">协作流水线</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-lg">
              在这里，你可以定义一个多模型协作房间。从模型库中挑选参与者，
              并按需排列它们的回答顺序。每一条发往该房间的消息，都会按照此链路流转。
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <p className="text-sm font-bold text-white/90">自由组合</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">支持不同 Provider 的模型在同一链路中共存。</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <p className="text-sm font-bold text-white/90">顺序流转</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">右侧列表即为回答顺序，实时拖拽，即刻生效。</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8">
                <p className="text-sm font-bold text-white/90">灵活扩展</p>
                <p className="mt-1 text-xs text-white/50 leading-relaxed">随时可以在编辑页增减成员或重排顺序。</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-amber-500 opacity-10 blur-[100px]" />
        </div>

        <div className="ly-glass flex flex-col rounded-[2.8rem] p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">房间配置</p>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">定义房间基础信息</h2>
          <div className="mt-8 space-y-5 flex-1">
            <div className="space-y-2.5">
              <label className="text-[13px] font-bold text-[var(--muted)] ml-1">房间名称</label>
              <input value={roomForm.title} onChange={(event) => setRoomForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)]" placeholder="例如：产品评审小组 / 深度逻辑分析" />
            </div>
            <div className="space-y-2.5">
              <label className="text-[13px] font-bold text-[var(--muted)] ml-1">房间类型</label>
              <select value={roomForm.type} onChange={(event) => { const nextType = event.target.value as RoomType; setRoomForm((current) => ({ ...current, type: nextType, modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds })); clearDragState(); }} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-4 text-[15px] font-medium outline-none transition focus:border-[var(--accent)]">
                <option value="GROUP">群聊 (多模型顺序协作)</option>
                <option value="SINGLE">单聊 (单模型快速对话)</option>
              </select>
            </div>
            {mockToolsEnabled ? (
              <button type="button" onClick={() => startTransition(() => void createLocalMockModels())} className="w-full flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/50 px-5 py-4 text-sm font-bold text-sky-700 transition hover:bg-sky-50 active:scale-95">
                <span>一键加载本地测试模型</span>
                <span className="text-[10px] opacity-60">QUICK SETUP</span>
              </button>
            ) : null}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-black/5 px-5 py-4 text-sm text-[var(--muted)]">
            <p className="leading-relaxed">
              {busy ? "正在同步模型状态..." : notice || "请在下方左侧选择模型，右侧定义它们的发言顺序。"}
            </p>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[1.8rem] border border-red-200 bg-red-50 px-6 py-4 text-sm font-bold text-red-600 shadow-sm animate-in fade-in slide-in-from-top-2">
          鈯 提示：{errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="ly-glass rounded-[2.6rem] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">模型库</p>
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">挑选参与成员</h2>
            </div>
            {selectedModels.length > 0 && (
              <button type="button" onClick={clearSelection} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-xs font-bold text-[var(--muted)] transition hover:border-red-200 hover:text-red-500">
                清空已选
              </button>
            )}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_200px]">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型..." className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-5 py-3 text-[14px] outline-none transition focus:border-[var(--accent)]" />
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-4 py-3 text-[14px] font-medium outline-none transition focus:border-[var(--accent)]">
              <option value="ALL">全部厂商</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {getProviderOptionLabel(provider)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 space-y-3">
            {filteredModels.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--muted)]">
                没有找到匹配的模型成员
              </div>
            ) : (
              filteredModels.map((model) => {
                const selected = roomForm.modelIds.includes(model.id);

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    className={`group flex w-full items-center justify-between gap-4 rounded-[2rem] border px-5 py-5 text-left transition-all ${
                      selected ? "border-[var(--accent)] bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/10" : "border-[var(--border)] bg-white/80 hover:border-[var(--accent)] hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-[10px] font-bold tracking-[0.2em] shadow-sm ${selected ? "bg-white/20 text-white" : getProviderIconClassName(model.provider)}`}>
                        {getProviderShortName(model.provider)}
                      </span>
                      <div className="min-w-0">
                        <p className={`font-bold tracking-tight ${selected ? "text-white" : "text-[var(--foreground)]"}`}>{model.name}</p>
                        <p className={`mt-0.5 text-[11px] font-medium opacity-60 truncate ${selected ? "text-white" : "text-[var(--muted)]"}`}>{model.modelName}</p>
                      </div>
                    </div>
                    {selected ? (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white">鉁</span>
                    ) : (
                      <span className="rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-[11px] font-bold text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">加入</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className="ly-glass rounded-[2.6rem] p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">流水线编排</p>
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">发言顺序</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {roomForm.type === "SINGLE" ? "当前为单聊模式，只能保留 1 个模型。" : "当前为群聊模式，你可以通过拖拽来调整模型回答的先后顺序。"}
            </p>

            <div className="mt-8 space-y-4">
              {selectedModels.length === 0 ? (
                <div className="rounded-[2.2rem] border border-dashed border-[var(--border)] bg-white/40 px-6 py-12 text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-black/5 flex items-center justify-center text-2xl text-black/20">鈫</div>
                  <p className="mt-4 text-sm font-bold text-[var(--muted)] opacity-60">请从左侧模型库中挑选成员</p>
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
                        className={`relative z-10 rounded-[2rem] border px-5 py-5 transition-all duration-300 ${
                          isDragging
                            ? "scale-[1.05] border-[var(--accent)] bg-white shadow-2xl ring-4 ring-[var(--accent)]/5 z-20"
                            : isDropTarget
                              ? "border-[var(--accent)] bg-[rgba(195,90,47,0.08)] translate-x-2"
                              : "border-[var(--border)] bg-white/90 hover:shadow-lg"
                        } ${roomForm.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                              <p className="font-bold tracking-tight">{model.name}</p>
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
                onClick={() => startTransition(() => void submitRoomForm())}
                disabled={!canCreateRoom || busy}
                className="w-full rounded-[2rem] bg-[var(--accent)] px-6 py-5 text-lg font-bold text-white shadow-xl shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-strong)] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0"
              >
                {busy ? "正在创建工作流..." : "完成并进入房间"}
              </button>

              <div className="flex items-center justify-center gap-6">
                <Link href="/rooms" className="text-[13px] font-bold text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                  返回房间列表
                </Link>
                <span className="h-1 w-1 rounded-full bg-[var(--border)]" />
                <button type="button" onClick={clearSelection} className="text-[13px] font-bold text-[var(--muted)] hover:text-red-500 transition-colors">
                  重置所有挑选
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
