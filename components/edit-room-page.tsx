"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  describeClientError,
  fetchJson,
  formatReplyLength,
  getProviderBadgeClassName,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
  reorderIds,
  toRoomLabel,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import type { ModelView, ProviderType, RoomType, RoomView } from "@/types/app";

interface EditRoomPageProps {
  roomId: string;
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback }) {
  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`mt-4 rounded-[1.6rem] border px-4 py-4 ${toneClassName}`}>
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

  const isBusy = activeAction !== null;

  async function loadModels() {
    const data = await fetchJson<{ models: ModelView[] }>("/api/models");
    setModels(data.models);
    return data.models;
  }

  async function loadRoom() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    setRoom(data.room);
    setForm({
      title: data.room.title,
      type: data.room.type,
      modelIds: data.room.roomModels.map((roomModel) => roomModel.modelId),
    });
    return data.room;
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

    try {
      await Promise.all([loadRoom(), loadModels()]);
      setNotice("房间配置已经加载完成。");
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

  const selectedModels = useMemo(
    () =>
      form.modelIds
        .map((modelId) => models.find((model) => model.id === modelId))
        .filter((model): model is ModelView => Boolean(model)),
    [form.modelIds, models],
  );

  const selectedDisabledModels = useMemo(
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
      room.roomModels.map((roomModel) => roomModel.modelId).join(",") !== form.modelIds.join(",")
    );
  }, [form.modelIds, form.title, form.type, room]);

  const canSubmit = Boolean(form.title.trim()) && countValid && selectedDisabledModels.length === 0 && dirty;

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  function resetForm() {
    if (!room) {
      return;
    }

    setForm({
      title: room.title,
      type: room.type,
      modelIds: room.roomModels.map((roomModel) => roomModel.modelId),
    });
    clearDragState();
    setFeedback(null);
  }

  function toggleModel(modelId: string) {
    const model = models.find((item) => item.id === modelId);

    if (!model) {
      return;
    }

    if (!model.enabled && !form.modelIds.includes(modelId)) {
      setFeedback({
        title: "该模型当前已停用",
        description: `${model.name} 目前不能加入房间，因为它在模型管理页被停用了。`,
        suggestion: "请先去模型管理页重新启用这个模型，或者改选别的可用模型。",
        tone: "warning",
      });
      return;
    }

    setForm((current) => {
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
    setForm((current) => ({
      ...current,
      modelIds: current.modelIds.filter((id) => id !== modelId),
    }));

    if (draggedModelId === modelId) {
      clearDragState();
    }
  }

  function previewSelectedModelMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) {
      return;
    }

    setForm((current) => {
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
        modelIds: data.room.roomModels.map((roomModel) => roomModel.modelId),
      });
      setNotice("房间配置已保存，后续消息会按新的成员和顺序执行。");
      router.push(`/rooms/${roomId}`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="rounded-[2.4rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,238,0.96),rgba(255,255,255,0.90))] px-5 py-6 shadow-[0_30px_90px_rgba(17,17,17,0.09)] sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-[rgba(191,95,54,0.14)] bg-[rgba(255,246,232,0.88)] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">
              ROOM SETTINGS
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">编辑房间</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                这里可以修改房间标题、单聊或群聊类型、参与模型和顺序。改动只影响后续轮次，不会改写历史消息。
              </p>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--muted)] lg:w-auto">
            {activeAction === "loading"
              ? "正在加载房间配置..."
              : activeAction === "saving"
                ? "正在保存房间配置..."
                : notice || "拖拽右侧卡片即可重新排序。"}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href={`/rooms/${roomId}`}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            返回聊天页
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            返回房间列表
          </Link>
          <button
            type="button"
            onClick={resetForm}
            disabled={!dirty || isBusy}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            撤销当前修改
          </button>
        </div>

        {feedback ? <FeedbackPanel feedback={feedback} /> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">房间配置</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">保存后会影响后续的发言顺序和参与模型。</p>
            </div>

            <div className="grid gap-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">房间名称</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="例如：多模型评审会"
                  className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--foreground)]">房间类型</span>
                <select
                  value={form.type}
                  onChange={(event) => {
                    const nextType = event.target.value as RoomType;
                    setForm((current) => ({
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

            <div className="mt-5 rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-4">
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
              <p className="mt-3 text-sm text-[var(--muted)]">
                当前显示 {filteredModels.length} / {models.length} 个模型，已选择 {selectedModels.length} 个。
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold">可选模型</h3>
                <span className="text-xs text-[var(--muted)]">{toRoomLabel(form.type)} 模式</span>
              </div>

              {filteredModels.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
                  当前筛选条件下没有模型，试试清空关键词或切换 Provider。
                </p>
              ) : (
                filteredModels.map((model) => {
                  const selected = form.modelIds.includes(model.id);

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModel(model.id)}
                      className={`flex w-full flex-col items-start gap-3 rounded-[1.8rem] border px-4 py-4 text-left transition-all duration-200 sm:flex-row sm:items-center sm:justify-between ${
                        selected
                          ? "border-[var(--accent)] bg-[rgba(191,95,54,0.08)] shadow-[0_12px_30px_rgba(17,17,17,0.06)]"
                          : "border-[var(--border)] bg-white/78 hover:-translate-y-0.5 hover:border-[var(--accent)]"
                      } ${!model.enabled && !selected ? "opacity-60" : ""}`}
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{model.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                model.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                              }`}
                            >
                              {model.enabled ? "已启用" : "已停用"}
                            </span>
                          </div>
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
                          {selected ? "已加入" : model.enabled ? "加入" : "不可加入"}
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
              <h2 className="text-2xl font-semibold">成员与顺序</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                调整后的顺序会应用到下一轮对话。历史消息里的旧模型回复仍然保留。
              </p>
            </div>

            <div className="mb-4 rounded-3xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
              {form.type === "SINGLE"
                ? "单聊需要恰好保留 1 个模型。"
                : "群聊至少需要 2 个模型，右侧顺序决定后续发言先后。"}
            </div>

            {selectedDisabledModels.length > 0 ? (
              <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                当前选择里有 {selectedDisabledModels.length} 个已停用模型，保存前需要先移除或重新启用它们。
              </div>
            ) : null}

            <div className="space-y-3">
              {selectedModels.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
                  左侧选中模型后，它们会出现在这里。群聊时可以直接拖拽调整顺序。
                </p>
              ) : (
                selectedModels.map((model, index) => {
                  const isDragging = draggedModelId === model.id;
                  const isDropTarget = dragOverModelId === model.id && draggedModelId !== model.id;

                  return (
                    <div
                      key={model.id}
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
                      } ${form.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{model.name}</p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  model.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                                }`}
                              >
                                {model.enabled ? "已启用" : "已停用"}
                              </span>
                            </div>
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
              onClick={() => startTransition(() => void saveConfiguration())}
              disabled={!canSubmit || isBusy}
              className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              保存配置并返回聊天页
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
