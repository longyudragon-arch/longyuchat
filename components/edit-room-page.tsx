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
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="ly-dark-panel ly-grid-lines rounded-[2.8rem] px-6 py-8 sm:px-8 sm:py-9">
          <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
            ROOM EDITOR
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">在不打断历史消息的前提下重构房间成员与顺序</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">
            这里负责修改房间标题、单聊或群聊类型、参与模型和后续发言顺序。旧消息不会被改写，但新一轮聊天会按这里保存的链路执行。
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">保留历史消息，只改后续轮次的成员与顺序。</div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">已停用模型会被清楚标记，避免误保存。</div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 text-white/82">编辑完成后直接回到聊天页继续工作。</div>
          </div>
        </div>

        <div className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">ROOM STATUS</p>
          <h2 className="mt-3 text-3xl font-semibold">当前正在编辑 {room?.title ? `「${room.title}」` : "房间配置"}</h2>
          <div className="mt-6 grid gap-3">
            <Link href={`/rooms/${roomId}`} className="rounded-[1.6rem] bg-[var(--accent)] px-5 py-4 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]">
              返回聊天页
            </Link>
            <Link href="/rooms" className="rounded-[1.6rem] border border-[var(--border)] bg-white/86 px-5 py-4 text-sm font-medium">
              返回房间列表
            </Link>
            <button type="button" onClick={resetForm} disabled={!dirty || activeAction !== null} className="rounded-[1.6rem] border border-[var(--border)] bg-white/86 px-5 py-4 text-left text-sm font-medium disabled:opacity-50">
              撤销当前修改
            </button>
          </div>
          <div className="mt-6 rounded-[1.7rem] border border-[var(--border)] bg-white/78 px-4 py-4 text-sm text-[var(--muted)]">
            {activeAction === "loading"
              ? "正在加载房间配置..."
              : activeAction === "saving"
                ? "正在保存房间配置..."
                : notice || "右侧顺序区会决定下一轮消息的真实执行顺序。"}
          </div>
        </div>
      </section>

      {feedback ? <FeedbackPanel feedback={feedback} /> : null}

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="ly-glass rounded-[2.5rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">CONFIG PANEL</p>
          <h2 className="mt-2 text-2xl font-semibold">调整房间信息与成员选择</h2>

          <div className="mt-5 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">房间名称</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">房间类型</span>
              <select value={form.type} onChange={(event) => { const nextType = event.target.value as RoomType; setForm((current) => ({ ...current, type: nextType, modelIds: nextType === "SINGLE" ? current.modelIds.slice(0, 1) : current.modelIds })); clearDragState(); }} className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]">
                <option value="GROUP">群聊</option>
                <option value="SINGLE">单聊</option>
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
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

            <div className="rounded-[1.6rem] border border-[var(--border)] bg-white/78 px-4 py-3 text-sm text-[var(--muted)]">
              当前显示 {filteredModels.length} / {models.length} 个模型，已选择 {selectedModels.length} 个。
            </div>

            <div className="grid gap-3">
              {filteredModels.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
                  当前筛选条件下没有匹配模型。
                </div>
              ) : (
                filteredModels.map((model) => {
                  const selected = form.modelIds.includes(model.id);

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModel(model.id)}
                      className={`flex w-full items-start justify-between gap-4 rounded-[1.8rem] border px-4 py-4 text-left transition ${
                        selected ? "border-[var(--accent)] bg-[rgba(195,90,47,0.08)]" : "border-[var(--border)] bg-white/84 hover:border-[var(--accent)]"
                      } ${!model.enabled && !selected ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(model.provider)}`}>
                          {getProviderShortName(model.provider)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{model.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${model.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
                              {model.enabled ? "已启用" : "已停用"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--muted)]">{model.modelName}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(model.provider)}`}>{getProviderOptionLabel(model.provider)}</span>
                            <span className="rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] text-[var(--muted)]">{formatReplyLength(model.defaultReplyLength)}</span>
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">{selected ? "已加入" : model.enabled ? "加入" : "不可加入"}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <div className="ly-glass rounded-[2.5rem] p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">PIPELINE STATUS</p>
            <h2 className="mt-2 text-2xl font-semibold">当前成员与顺序</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{toRoomLabel(form.type)} 模式下，保存后的顺序会在下一轮聊天里生效。</p>

            {disabledSelectedModels.length > 0 ? (
              <div className="mt-5 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                当前选择里有 {disabledSelectedModels.length} 个已停用模型，保存前需要先移除或重新启用它们。
              </div>
            ) : null}

            <div className="mt-5 rounded-[1.6rem] border border-[var(--border)] bg-white/78 px-4 py-3 text-sm text-[var(--muted)]">
              {form.type === "SINGLE" ? "单聊需要且只能有 1 个模型。" : "群聊至少需要 2 个模型，拖拽即可重排。"}
            </div>

            <div className="mt-5 grid gap-3">
              {selectedModels.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">左边选中模型后，它们会出现在这里。</div>
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
                      } ${form.type === "GROUP" ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                            <p className="mt-1 text-xs text-[var(--muted)]">{getProviderOptionLabel(model.provider)}</p>
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
              onClick={() => startTransition(() => void saveConfiguration())}
              disabled={!dirty || !countValid || disabledSelectedModels.length > 0 || activeAction !== null}
              className="mt-6 w-full rounded-[1.6rem] bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              保存配置并返回聊天页
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
