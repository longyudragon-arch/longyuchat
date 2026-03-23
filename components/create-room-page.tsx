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
    <main className="ly-shell flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[3.5rem] px-8 py-10 sm:px-12 sm:py-14 shadow-2xl">
          <div className="relative z-10 animate-fade-in-up">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.24em] text-white/90 uppercase backdrop-blur-md shadow-inner">
              协作编排
            </span>
            <h1 className="mt-8 text-5xl font-display font-bold tracking-tight sm:text-6xl xl:text-[4.5rem] xl:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60">
              搭建你的 AI <br />
              <span className="text-white/40 font-light">协作流水线</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[1.0625rem] font-medium leading-[1.8] text-white/70">
              在这里，你可以定义一个多模型协作房间。从模型库中挑选参与者，
              并按需排列它们的回答顺序。每一条发往该房间的消息，都会按照此链路流转。
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[14px] font-bold text-white/90">自由组合</p>
                <p className="mt-2 text-[12px] font-medium text-white/50 leading-relaxed">支持不同厂商的模型在同一链路中协作。</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[14px] font-bold text-white/90">顺序流转</p>
                <p className="mt-2 text-[12px] font-medium text-white/50 leading-relaxed">右侧列表即为回答顺序，实时拖拽，即刻生效。</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/5 p-6 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
                <p className="text-[14px] font-bold text-white/90">灵活扩展</p>
                <p className="mt-2 text-[12px] font-medium text-white/50 leading-relaxed">随时可以在编辑页增减成员或重排顺序。</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] opacity-15 blur-[120px] animate-pulse-slow" />
        </div>

        <div className="ly-glass flex flex-col rounded-[3.5rem] p-8 sm:p-10 shadow-xl shadow-[var(--accent)]/5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
            <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">房间配置</p>
          </div>
          <h2 className="mt-5 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">定义房间基础信息</h2>
          <div className="mt-10 space-y-6 flex-1">
            <div className="space-y-3">
              <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">房间名称</label>
              <input value={roomForm.title} onChange={(event) => setRoomForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner" placeholder="例如：产品评审小组 / 深度逻辑分析" />
            </div>
            <div className="space-y-3">
              <label className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase ml-2">房间类型</label>
              <select value={roomForm.type} onChange={(event) => { const nextType = event.target.value as RoomType; setRoomForm((current) => ({ ...current, type: nextType, modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds })); clearDragState(); }} className="w-full rounded-[1.5rem] border border-white/40 bg-white/50 px-6 py-4.5 text-[15px] font-medium outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md shadow-inner appearance-none cursor-pointer">
                <option value="GROUP">群聊 (多模型顺序协作)</option>
                <option value="SINGLE">单聊 (单模型快速对话)</option>
              </select>
            </div>
            {mockToolsEnabled ? (
              <button type="button" onClick={() => startTransition(() => void createLocalMockModels())} className="w-full flex items-center justify-between rounded-[1.5rem] border border-sky-200/50 bg-sky-50/50 px-6 py-5 text-[14px] font-bold text-sky-700 transition-all duration-300 hover:bg-sky-50 hover:shadow-md active:scale-95 backdrop-blur-sm">
                <span>一键加载本地测试模型</span>
                <span className="text-[10px] opacity-60 tracking-[0.1em]">快速配置</span>
              </button>
            ) : null}
          </div>
          <div className="mt-8 flex items-start gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white/40 px-6 py-5 text-[14px] text-[var(--muted)] backdrop-blur-sm transition-colors hover:bg-white/60">
            <p className="leading-relaxed font-medium">
              {busy ? "正在同步模型状态..." : notice || "请在下方左侧选择模型，右侧定义它们的发言顺序。"}
            </p>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[2rem] border border-red-200/50 bg-red-50/80 px-8 py-5 text-[14px] font-bold text-red-600 shadow-lg shadow-red-500/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          提示：{errorMessage}
        </div>
      ) : null}

      <section className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">模型库</p>
              </div>
              <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">挑选参与成员</h2>
            </div>
            {selectedModels.length > 0 && (
              <button type="button" onClick={clearSelection} className="rounded-full border border-white/60 bg-white/50 px-5 py-2.5 text-[12px] font-bold text-[var(--muted)] shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-red-200 hover:text-red-500 hover:bg-white">
                清空已选
              </button>
            )}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-[1fr_220px]">
            <div className="relative group">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold opacity-40 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all duration-300">搜索</span>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索模型..." className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 pl-14 pr-6 py-5 text-[15px] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 backdrop-blur-md shadow-inner" />
            </div>
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")} className="w-full rounded-[1.75rem] border border-white/40 bg-white/50 px-6 py-5 text-[15px] font-bold text-[var(--foreground)] outline-none transition-all duration-300 focus:bg-white focus:border-[var(--accent)] backdrop-blur-md appearance-none shadow-sm cursor-pointer">
              <option value="ALL">全部厂商</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {getProviderOptionLabel(provider)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8 space-y-4">
            {filteredModels.length === 0 ? (
              <div className="rounded-[2.5rem] border border-dashed border-white/60 bg-white/20 px-8 py-14 text-center text-[15px] font-medium text-[var(--muted)] backdrop-blur-sm">
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
                    className={`group flex w-full items-center justify-between gap-5 rounded-[2.5rem] border px-6 py-6 text-left transition-all duration-500 hover:-translate-y-1 ${
                      selected ? "border-[var(--accent)]/50 bg-[linear-gradient(135deg,rgba(153,60,80,0.8),rgba(199,87,111,0.8))] shadow-xl shadow-[var(--accent)]/20 backdrop-blur-md" : "border-white/40 bg-white/30 hover:bg-white/60 hover:border-white/80 hover:shadow-[0_16px_40px_rgba(47,46,51,0.06)] backdrop-blur-md"
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] text-[11px] font-bold tracking-[0.2em] shadow-md transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${selected ? "bg-white/20 text-white shadow-[0_0_16px_rgba(255,255,255,0.2)]" : getProviderIconClassName(model.provider)}`}>
                        {getProviderShortName(model.provider)}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[16px] font-display font-bold tracking-tight ${selected ? "text-white" : "text-[var(--foreground)]"}`}>{model.name}</p>
                        <p className={`mt-1 text-[12px] font-medium tracking-wide truncate ${selected ? "text-white/80" : "text-[var(--muted)]"}`}>{model.modelName}</p>
                      </div>
                    </div>
                    {selected ? (
                      <span className="inline-flex h-10 items-center justify-center rounded-full bg-white/20 px-4 text-[12px] font-bold text-white shadow-inner backdrop-blur-md transition-transform duration-300 group-hover:scale-105">已选</span>
                    ) : (
                      <span className="rounded-full border border-white/60 bg-white/50 px-5 py-2.5 text-[12px] font-bold text-[var(--muted)] shadow-sm transition-colors duration-300 group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] group-hover:bg-white">加入</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <div className="ly-glass rounded-[3.5rem] p-8 sm:p-10 shadow-lg shadow-black/5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">流水线编排</p>
            </div>
            <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">发言顺序</h2>
            <p className="mt-3 text-[14px] font-medium leading-relaxed text-[var(--muted)] opacity-90">
              {roomForm.type === "SINGLE" ? "当前为单聊模式，只能保留 1 个模型。" : "当前为群聊模式，你可以通过拖拽来调整模型回答的先后顺序。"}
            </p>

            <div className="mt-10 space-y-5">
              {selectedModels.length === 0 ? (
                <div className="rounded-[2.5rem] border border-dashed border-white/60 bg-white/20 px-8 py-16 text-center backdrop-blur-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--foreground)]/5 text-xl font-bold text-[var(--foreground)]/25 shadow-inner">→</div>
                  <p className="mt-5 text-[15px] font-bold text-[var(--muted)] opacity-70">请从左侧模型库中挑选成员</p>
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
                        className={`relative z-10 rounded-[2.5rem] border px-6 py-6 transition-all duration-300 ${
                          isDragging
                            ? "scale-[1.05] border-[var(--accent)] bg-[rgba(255,255,255,0.95)] shadow-2xl shadow-[var(--accent)]/10 ring-4 ring-[var(--accent)]/10 z-20"
                            : isDropTarget
                              ? "border-[var(--accent)] bg-[rgba(153,60,80,0.05)] translate-x-3 backdrop-blur-md"
                              : "border-white/50 bg-white/40 hover:bg-white/60 hover:shadow-[0_16px_40px_rgba(47,46,51,0.04)] backdrop-blur-md"
                        } ${roomForm.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-5">
                          <div className="flex items-center gap-5">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] text-[13px] font-bold text-white shadow-md shadow-[var(--accent)]/20 relative z-10">
                              {index + 1}
                            </span>
                            <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.25rem] text-[11px] font-bold tracking-[0.2em] shadow-md ${getProviderIconClassName(model.provider)}`}>
                              {getProviderShortName(model.provider)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[16px] font-display font-bold tracking-tight text-[var(--foreground)]">{model.name}</p>
                              <p className="mt-1 text-[11px] font-bold tracking-widest text-[var(--muted)] opacity-60 uppercase">{getProviderChineseLabel(model.provider)}</p>
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
                onClick={() => startTransition(() => void submitRoomForm())}
                disabled={!canCreateRoom || busy}
                className="w-full relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#993c50,#c7576f)] px-8 py-6 text-[18px] font-display font-bold text-white shadow-[0_16px_32px_rgba(153,60,80,0.2)] transition-all duration-500 hover:shadow-[0_24px_48px_rgba(153,60,80,0.3)] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_16px_32px_rgba(153,60,80,0.2)] group"
              >
                <span className="relative z-10">{busy ? "正在创建工作流..." : "完成并进入房间"}</span>
                {!busy && canCreateRoom && (
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                )}
              </button>

              <div className="flex items-center justify-center gap-6 pt-2">
                <Link href="/rooms" className="text-[13px] font-bold text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                  返回房间列表
                </Link>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--border)]" />
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
