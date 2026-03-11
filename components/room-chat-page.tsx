"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  describeClientError,
  describePartialSendResult,
  fetchJson,
  formatDate,
  formatReplyLength,
  getProviderBadgeClassName,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  getProviderSoftClassName,
  reorderIds,
  sendRoomMessageRequest,
  toRoleLabel,
  toRoomLabel,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import type { MessageView, RoomView } from "@/types/app";

interface RoomChatPageProps {
  roomId: string;
}

type RoomAction = "loading" | "sending" | "saving-order" | "renaming-room" | "deleting-room" | null;

function RoomChatSkeleton() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="animate-pulse rounded-[2.2rem] border border-[var(--border)] bg-[var(--card)] px-5 py-6 sm:px-6 sm:py-8">
        <div className="h-4 w-32 rounded-full bg-[rgba(191,95,54,0.14)]" />
        <div className="mt-5 h-11 w-72 rounded-2xl bg-zinc-200/80" />
        <div className="mt-3 h-5 w-full max-w-3xl rounded-xl bg-zinc-200/70" />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <div className="h-[560px] animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--card)]" />
        <div className="h-[420px] animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--card)]" />
      </section>
    </main>
  );
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback | null }) {
  if (!feedback) {
    return null;
  }

  const toneClassName =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`rounded-[1.4rem] border px-4 py-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{feedback.title}</p>
      <p className="mt-2 text-sm leading-6">{feedback.description}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">建议：{feedback.suggestion}</p>
    </div>
  );
}

function DeliveryBadge({ text, className }: { text: string; className: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{text}</span>;
}

function getUserMessageDeliveryStatus(message: MessageView, messages: MessageView[], expectedAssistantCount: number) {
  const nextUserMessage = messages.find((candidate) => candidate.role === "USER" && candidate.sequence > message.sequence);
  const nextUserSequence = nextUserMessage?.sequence ?? Number.POSITIVE_INFINITY;
  const assistantMessagesInRound = messages.filter(
    (candidate) =>
      candidate.role === "ASSISTANT" &&
      candidate.sequence > message.sequence &&
      candidate.sequence < nextUserSequence,
  );

  if (assistantMessagesInRound.length === 0) {
    return "sent" as const;
  }

  if (assistantMessagesInRound.length >= expectedAssistantCount) {
    return "completed" as const;
  }

  return "partial" as const;
}

export function RoomChatPage({ roomId }: RoomChatPageProps) {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const [room, setRoom] = useState<RoomView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [pendingUserContent, setPendingUserContent] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [notice, setNotice] = useState("");
  const [activeAction, setActiveAction] = useState<RoomAction>("loading");
  const [draftModelIds, setDraftModelIds] = useState<string[]>([]);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "order">("chat");

  const isBusy = activeAction !== null;
  const isSending = activeAction === "sending";

  async function loadRoom() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    setRoom(data.room);
    setDraftModelIds(data.room.roomModels.map((roomModel) => roomModel.modelId));
  }

  async function loadMessages() {
    const data = await fetchJson<{ messages: MessageView[] }>(`/api/rooms/${roomId}/messages`);
    setMessages(data.messages);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    try {
      await Promise.all([loadRoom(), loadMessages()]);
      setNotice("房间已加载。");
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

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingUserContent, isSending]);

  const orderedRoomModels = useMemo(() => {
    if (!room) {
      return [];
    }

    return draftModelIds
      .map((modelId) => room.roomModels.find((roomModel) => roomModel.modelId === modelId))
      .filter((roomModel): roomModel is RoomView["roomModels"][number] => Boolean(roomModel));
  }, [draftModelIds, room]);

  const orderDirty = useMemo(() => {
    if (!room) {
      return false;
    }

    return room.roomModels.map((roomModel) => roomModel.modelId).join(",") !== draftModelIds.join(",");
  }, [draftModelIds, room]);

  function previewMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) {
      return;
    }

    setDraftModelIds((current) => reorderIds(current, draggedModelId, targetId));
    setDragOverModelId(targetId);
  }

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  async function saveOrder() {
    if (!room || !orderDirty) {
      return;
    }

    setActiveAction("saving-order");
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}/order`, {
        method: "PUT",
        body: JSON.stringify({ modelIds: draftModelIds }),
      });
      setRoom(data.room);
      setDraftModelIds(data.room.roomModels.map((roomModel) => roomModel.modelId));
      setNotice("顺序已保存。");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function renameRoom() {
    if (!room) {
      return;
    }

    const nextTitle = window.prompt("请输入新的房间名称：", room.title);
    if (!nextTitle || nextTitle.trim() === room.title) {
      return;
    }

    setActiveAction("renaming-room");
    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: nextTitle.trim() }),
      });
      setRoom(data.room);
      setNotice(`房间已改名为“${data.room.title}”。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteRoom() {
    if (!room || !window.confirm(`确认删除房间“${room.title}”吗？`)) {
      return;
    }

    setActiveAction("deleting-room");
    try {
      await fetchJson(`/api/rooms/${room.id}`, { method: "DELETE" });
      router.push("/rooms");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
      setActiveAction(null);
    }
  }

  async function sendMessage() {
    if (!room || !messageInput.trim()) {
      return;
    }

    if (orderDirty) {
      setFeedback({
        title: "请先保存排序",
        description: "你刚刚调整了模型顺序，但服务端还没有保存。",
        suggestion: "先点击右侧“保存排序”，再发送消息。",
        tone: "warning",
      });
      return;
    }

    const normalizedContent = messageInput.trim();
    setActiveAction("sending");
    setPendingUserContent(normalizedContent);
    setFeedback(null);

    try {
      const result = await sendRoomMessageRequest(room.id, normalizedContent);
      setMessageInput("");
      setPendingUserContent("");
      await Promise.all([loadMessages(), loadRoom()]);

      if (result.status === "partial") {
        const failedModel =
          room.roomModels.find((roomModel) => roomModel.modelId === result.failedModelId)?.model.name ?? "未知模型";
        setFeedback(describePartialSendResult(result, failedModel));
        setNotice("本轮回复部分完成。");
      } else {
        setNotice("消息已发送，本轮顺序回复已完成。");
      }
    } catch (error: unknown) {
      setPendingUserContent("");
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!isBusy) {
        startTransition(() => void sendMessage());
      }
    }
  }

  if (activeAction === "loading" && !room) {
    return <RoomChatSkeleton />;
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="rounded-[2.3rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,236,0.96),rgba(255,255,255,0.90))] px-5 py-6 shadow-[0_30px_90px_rgba(17,17,17,0.09)] sm:px-6 sm:py-8">
        <span className="inline-flex rounded-full border border-[rgba(166,73,36,0.16)] bg-[rgba(255,246,232,0.86)] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">
          CONVERSATION ROOM
        </span>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">{room?.title ?? "正在加载房间..."}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              更正式的聊天工作区，统一了模型身份、发送状态、顺序编排和移动端切换。
            </p>
            {room ? (
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-[var(--border)] bg-white/82 px-3 py-2 text-[var(--muted)]">
                  {toRoomLabel(room.type)}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white/82 px-3 py-2 text-[var(--muted)]">
                  {room.roomModels.length} 个模型参与
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white/82 px-3 py-2 text-[var(--muted)]">
                  累计 {room.messageCount} 条消息
                </span>
              </div>
            ) : null}
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/82 px-4 py-3 text-sm text-[var(--muted)]">
            {notice || "可以开始聊天，也可以先调整顺序。"}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Link href="/rooms" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)]">返回房间列表</Link>
          <Link href="/rooms/new" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)]">新建房间</Link>
          <Link href={`/rooms/${roomId}/edit`} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)]">编辑房间</Link>
          <button type="button" onClick={() => startTransition(() => void renameRoom())} disabled={!room || isBusy} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] disabled:opacity-60">重命名房间</button>
          <button type="button" onClick={() => startTransition(() => void deleteRoom())} disabled={!room || isBusy} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 disabled:opacity-60">删除房间</button>
        </div>
      </section>

      <FeedbackPanel feedback={feedback} />

      <section className="xl:hidden">
        <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] border border-[var(--border)] bg-[var(--card)] p-2">
          <button type="button" onClick={() => setMobilePanel("chat")} className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${mobilePanel === "chat" ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted)]"}`}>聊天</button>
          <button type="button" onClick={() => setMobilePanel("order")} className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${mobilePanel === "order" ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted)]"}`}>顺序</button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <div className={`${mobilePanel === "chat" ? "block" : "hidden"} rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6 xl:block`}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">聊天区</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{room ? `${toRoomLabel(room.type)} / 最后更新于 ${formatDate(room.updatedAt)}` : "正在读取房间信息"}</p>
            </div>
          </div>

          <div className="flex min-h-[420px] flex-col rounded-[1.8rem] border border-[var(--border)] bg-white/75 sm:min-h-[560px]">
            <div ref={messageListRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {messages.map((message) => {
                if (message.role === "USER") {
                  const status = getUserMessageDeliveryStatus(message, messages, room?.roomModels.length ?? 1);
                  const badge =
                    status === "completed"
                      ? <DeliveryBadge text="已完成" className="border-emerald-200 bg-emerald-50 text-emerald-700" />
                      : status === "partial"
                        ? <DeliveryBadge text="部分完成" className="border-amber-200 bg-amber-50 text-amber-700" />
                        : <DeliveryBadge text="已送达" className="border-emerald-200 bg-emerald-50 text-emerald-700" />;

                  return (
                    <article key={message.id} className="ml-auto max-w-[96%] rounded-[1.7rem] bg-[var(--accent)] px-4 py-3 text-white shadow-[0_12px_24px_rgba(17,17,17,0.06)] sm:max-w-[90%]">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-75">
                          <span>{toRoleLabel(message.role)}</span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        {badge}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                    </article>
                  );
                }

                const roomModel = room?.roomModels.find((candidate) => candidate.modelId === message.modelId) ?? null;
                const messageModel = roomModel?.model ?? message.model;
                const provider = messageModel?.provider;

                return (
                  <article key={message.id} className={`max-w-[96%] rounded-[1.7rem] px-4 py-3 shadow-[0_12px_24px_rgba(17,17,17,0.06)] sm:max-w-[90%] ${provider ? getProviderSoftClassName(provider) : "bg-[rgb(255,252,247)]"}`}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {provider ? (
                        <>
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] ${getProviderIconClassName(provider)}`}>{getProviderShortName(provider)}</span>
                          <span className="text-sm font-medium">{messageModel?.name ?? "AI"}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(provider)}`}>{getProviderOptionLabel(provider)}</span>
                          <span className="text-xs text-[var(--muted)]">{formatReplyLength(messageModel?.defaultReplyLength ?? 300)}</span>
                        </>
                      ) : <span className="text-sm font-medium">AI</span>}
                      <span className="text-xs text-[var(--muted)]">{formatDate(message.createdAt)}</span>
                    </div>
                    <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{toRoleLabel(message.role)}</div>
                    <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                  </article>
                );
              })}

              {pendingUserContent ? (
                <article className="ml-auto max-w-[96%] rounded-[1.7rem] border border-[var(--accent)] bg-[rgba(191,95,54,0.10)] px-4 py-3 sm:max-w-[90%]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">用户</span>
                    <DeliveryBadge text="发送中" className="border-zinc-200 bg-white/80 text-zinc-500" />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7">{pendingUserContent}</p>
                </article>
              ) : null}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
              <textarea value={messageInput} onChange={(event) => setMessageInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="输入消息并发送，Enter 发送，Shift+Enter 换行..." rows={4} className="w-full resize-none rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]" />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-xs ${orderDirty ? "text-amber-700" : "text-[var(--muted)]"}`}>{orderDirty ? "当前有未保存的顺序调整，请先保存排序。" : "当前会按固定顺序发言，并带上默认回复字数限制。"}</p>
                <button type="button" onClick={() => startTransition(() => void sendMessage())} disabled={!messageInput.trim() || isBusy} className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto">{isSending ? "等待回复中..." : "发送消息"}</button>
              </div>
            </div>
          </div>
        </div>

        <aside className={`${mobilePanel === "order" ? "block" : "hidden"} space-y-6 xl:block`}>
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <h2 className="text-2xl font-semibold">模型顺序</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">拖拽卡片就会实时换位，保存后下一轮严格按此顺序执行。</p>
            <div className={`mt-4 rounded-3xl border px-4 py-3 text-sm ${orderDirty ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[var(--border)] bg-white/70 text-[var(--muted)]"}`}>{orderDirty ? "当前顺序有调整，但服务端还没有保存。" : "当前顺序已经保存。"}</div>

            <div className="mt-4 space-y-3">
              {orderedRoomModels.map((roomModel, index) => (
                <div
                  key={roomModel.id}
                  draggable={orderedRoomModels.length > 1 && !isBusy}
                  onDragStart={(event) => {
                    setDraggedModelId(roomModel.modelId);
                    setDragOverModelId(roomModel.modelId);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", roomModel.modelId);
                  }}
                  onDragEnter={() => previewMove(roomModel.modelId)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    previewMove(roomModel.modelId);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    clearDragState();
                  }}
                  onDragEnd={clearDragState}
                  className={`rounded-[1.7rem] border px-4 py-4 transition-all ${dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId ? "border-[var(--accent)] bg-[rgba(191,95,54,0.10)]" : "border-[var(--border)] bg-white/80"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(roomModel.model.provider)}`}>{getProviderShortName(roomModel.model.provider)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">{index + 1}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(roomModel.model.provider)}`}>{getProviderOptionLabel(roomModel.model.provider)}</span>
                      </div>
                      <p className="mt-2 font-medium">{roomModel.model.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">默认回复字数：{formatReplyLength(roomModel.model.defaultReplyLength)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => startTransition(() => void saveOrder())} disabled={!orderDirty || isBusy} className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300">{activeAction === "saving-order" ? "正在保存..." : "保存排序"}</button>
          </div>
        </aside>
      </section>
    </main>
  );
}
