"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  ensureLocalMockModels,
  fetchJson,
  formatReplyLength,
  getProviderBadgeClassName,
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

  const selectedModels = useMemo(
    () =>
      roomForm.modelIds
        .map((modelId) => models.find((model) => model.id === modelId))
        .filter((model): model is ModelView => Boolean(model)),
    [models, roomForm.modelIds],
  );

  const filteredModels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return models.filter((model) => {
      const matchesProvider = providerFilter === "ALL" || model.provider === providerFilter;
      const searchableText = [model.name, model.modelName, getProviderOptionLabel(model.provider)]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesProvider && matchesQuery;
    });
  }, [models, providerFilter, searchQuery]);

  const canCreateRoom =
    roomForm.type === "SINGLE" ? selectedModels.length === 1 : selectedModels.length >= 2;

  const handleInitialLoad = useEffectEvent(async () => {
    setBusy(true);
    setErrorMessage("");

    try {
      await loadModels();
      setNotice("可以开始配置房间。");
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

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  function toggleModel(modelId: string) {
    setRoomForm((current) => {
      const exists = current.modelIds.includes(modelId);

      if (current.type === "SINGLE") {
        return {
          ...current,
          modelIds: exists ? [] : [modelId],
        };
      }

      return {
        ...current,
        modelIds: exists ? current.modelIds.filter((id) => id !== modelId) : [...current.modelIds, modelId],
      };
    });
  }

  function removeSelectedModel(modelId: string) {
    setRoomForm((current) => ({
      ...current,
      modelIds: current.modelIds.filter((id) => id !== modelId),
    }));

    if (draggedModelId === modelId) {
      clearDragState();
    }
  }

  function clearSelection() {
    setRoomForm((current) => ({
      ...current,
      modelIds: [],
    }));
    clearDragState();
  }

  function previewSelectedModelMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) {
      return;
    }

    setRoomForm((current) => {
      const nextModelIds = reorderIds(current.modelIds, draggedModelId, targetId);

      if (nextModelIds.join(",") === current.modelIds.join(",")) {
        return current;
      }

      return {
        ...current,
        modelIds: nextModelIds,
      };
    });
    setDragOverModelId(targetId);
  }

  async function createLocalMockModels() {
    setBusy(true);
    setErrorMessage("");

    try {
      const mockModels = await ensureLocalMockModels();
      await loadModels();
      setRoomForm((current) => ({
        ...current,
        type: "GROUP",
        modelIds: mockModels.map((model) => model.id),
        title: current.title || "本地测试群聊",
      }));
      setNotice("本地测试模型已经加入排序列表，你可以直接拖拽调整顺序。");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "加载本地测试模型失败。");
    } finally {
      setBusy(false);
    }
  }

  async function submitRoomForm() {
    if (!canCreateRoom) {
      setErrorMessage(roomForm.type === "SINGLE" ? "单聊需要恰好选择 1 个模型。" : "群聊至少需要 2 个模型。");
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
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="rounded-[2.4rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,238,0.96),rgba(255,255,255,0.90))] px-5 py-6 shadow-[0_30px_90px_rgba(17,17,17,0.09)] sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-[rgba(191,95,54,0.14)] bg-[rgba(255,246,232,0.88)] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">
              ROOM CREATION
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">新建房间</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                从模型筛选、房间类型到拖拽排序，一次把顺序协作的规则配置清楚。右侧排序区会在拖拽时实时换位。
              </p>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--muted)] lg:w-auto">
            {busy ? "正在处理..." : notice || "拖拽右侧卡片即可实时调整顺序。"}
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">房间基础信息</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">先确定房间类型，再把模型加入右侧的顺序链路。</p>
              </div>
              <Link
                href="/rooms"
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                返回房间列表
              </Link>
            </div>

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">房间名称</span>
                <input
                  value={roomForm.title}
                  onChange={(event) => setRoomForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="例如：产品方案讨论群"
                  className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">房间类型</span>
                <select
                  value={roomForm.type}
                  onChange={(event) => {
                    const nextType = event.target.value as RoomType;
                    setRoomForm((current) => ({
                      ...current,
                      type: nextType,
                      modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds,
                    }));
                    clearDragState();
                  }}
                  className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="GROUP">群聊</option>
                  <option value="SINGLE">单聊</option>
                </select>
              </label>
            </div>

            {mockToolsEnabled ? (
              <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[rgba(191,95,54,0.08)] p-4">
                <p className="text-sm font-medium">本地测试支持</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  如果你还没配置真实模型，可以先一键加载本地 mock 模型，再在右侧直接拖拽排序测试聊天体验。
                </p>
                <button
                  type="button"
                  onClick={() => startTransition(() => void createLocalMockModels())}
                  className="mt-4 w-full rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] sm:w-auto"
                >
                  加载本地测试模型
                </button>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold">可选模型</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted)]">{toRoomLabel(roomForm.type)} 模式</span>
                  {selectedModels.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-xs font-medium text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
                    >
                      清空已选
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索模型名称、模型 ID 或 Provider"
                  className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                />
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value as ProviderType | "ALL")}
                  className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="ALL">全部 Provider</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {getProviderOptionLabel(provider)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
                当前显示 {filteredModels.length} / {models.length} 个可用模型，已选择 {selectedModels.length} 个。
              </div>

              {models.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
                  {mockToolsEnabled
                    ? "没有可用模型。先去模型管理页配置，或者先加载本地测试模型。"
                    : "没有可用模型。请先去模型管理页启用至少一个模型。"}
                </p>
              ) : filteredModels.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
                  当前筛选条件下没有可选模型，试试清空关键词或切换 Provider。
                </p>
              ) : (
                filteredModels.map((model) => {
                  const selected = roomForm.modelIds.includes(model.id);

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModel(model.id)}
                      className={`flex w-full flex-col items-start gap-3 rounded-[1.8rem] border px-4 py-4 text-left transition-all duration-200 sm:flex-row sm:items-center sm:justify-between ${
                        selected
                          ? "border-[var(--accent)] bg-[rgba(191,95,54,0.08)] shadow-[0_12px_30px_rgba(17,17,17,0.06)]"
                          : "border-[var(--border)] bg-white/78 hover:-translate-y-0.5 hover:border-[var(--accent)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(
                            model.provider,
                          )}`}
                        >
                          {getProviderShortName(model.provider)}
                        </span>
                        <div>
                          <p className="font-medium">{model.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{getProviderOptionLabel(model.provider)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">模型 ID：{model.modelName}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            默认回复上限：{formatReplyLength(model.defaultReplyLength)}
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full flex-row items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(
                            model.provider,
                          )}`}
                        >
                          {getProviderShortName(model.provider)}
                        </span>
                        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                          {selected ? "已加入" : "加入"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">参与顺序</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                群聊模式下，拖拽卡片就会实时交换位置；单聊只保留 1 个模型，不需要排序。
              </p>
            </div>

            <div className="mb-4 rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
              当前已选择 {selectedModels.length} 个模型。
              {roomForm.type === "SINGLE" ? " 单聊需要恰好 1 个模型。" : " 群聊至少需要 2 个模型。"}
            </div>

            <div className="space-y-3">
              {selectedModels.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
                  左侧选中模型后，它们会出现在这里。群聊时可以直接拖拽卡片调整顺序。
                </p>
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
                        event.dataTransfer.dropEffect = "move";
                        previewSelectedModelMove(model.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        clearDragState();
                      }}
                      onDragEnd={clearDragState}
                      className={`relative overflow-hidden rounded-[1.8rem] border px-4 py-4 transition-all duration-200 ease-out will-change-transform ${
                        isDragging
                          ? "scale-[1.02] border-[var(--accent)] bg-[rgba(191,95,54,0.14)] shadow-[0_24px_60px_rgba(17,17,17,0.12)]"
                          : isDropTarget
                            ? "translate-x-1 border-[var(--accent)] bg-[rgba(191,95,54,0.10)] shadow-[0_18px_40px_rgba(17,17,17,0.10)]"
                            : "border-[var(--border)] bg-white/80"
                      } ${roomForm.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                    >
                      <div
                        className={`absolute inset-x-4 top-0 h-1 rounded-full bg-[var(--accent)] transition-opacity ${
                          isDropTarget ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(
                              model.provider,
                            )}`}
                          >
                            {getProviderShortName(model.provider)}
                          </span>
                          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{model.name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{getProviderOptionLabel(model.provider)}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              默认回复上限：{formatReplyLength(model.defaultReplyLength)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeSelectedModel(model.id)}
                          className="w-full rounded-full border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 sm:w-auto"
                        >
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
              className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              创建房间并进入聊天
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
