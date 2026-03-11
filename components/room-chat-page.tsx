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
  type ClientErrorFeedback,
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
} from "@/lib/client/chat-lab-client";
import type { MessageView, RoomView } from "@/types/app";

interface RoomChatPageProps {
  roomId: string;
}

type RoomAction = "loading" | "sending" | "saving-order" | "renaming-room" | "deleting-room" | null;

function RoomChatSkeleton() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--card)] px-5 py-6 sm:px-6 sm:py-8">
        <div className="h-4 w-28 rounded-full bg-[rgba(191,95,54,0.14)]" />
        <div className="mt-5 h-11 w-72 rounded-2xl bg-zinc-200/80" />
        <div className="mt-3 h-5 w-full max-w-3xl rounded-xl bg-zinc-200/70" />
        <div className="mt-2 h-5 w-full max-w-2xl rounded-xl bg-zinc-200/60" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="h-8 w-32 rounded-xl bg-zinc-200/80" />
          <div className="mt-2 h-4 w-56 rounded-xl bg-zinc-200/60" />
          <div className="mt-6 space-y-4 rounded-[1.75rem] border border-[var(--border)] bg-white/70 p-4 sm:p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`message-skeleton-${index}`}
                className={`h-24 rounded-[1.6rem] ${
                  index % 2 === 0 ? "mr-20 bg-zinc-100" : "ml-20 bg-[rgba(191,95,54,0.10)]"
                }`}
              />
            ))}
          </div>
        </div>

        <aside className="animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <div className="h-8 w-32 rounded-xl bg-zinc-200/80" />
          <div className="mt-2 h-4 w-56 rounded-xl bg-zinc-200/60" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`order-skeleton-${index}`} className="h-24 rounded-[1.7rem] bg-zinc-100" />
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
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

function MessageDeliveryIndicator({
  status,
}: {
  status: "sending" | "sent" | "completed" | "partial";
}) {
  if (status === "sending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-zinc-500">
        <span className="h-2 w-2 rounded-full bg-zinc-400" />
        发送中
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-amber-700">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
          <path d="M7.7 13.7 4.5 10.5l-1.1 1.1 4.3 4.3L16.6 7l-1.1-1.1-7.8 7.8Z" />
        </svg>
        部分完成
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-emerald-700">
        <svg viewBox="0 0 24 20" aria-hidden="true" className="h-3.5 w-4 fill-current">
          <path d="M8.2 13.7 5 10.5l-1.1 1.1 4.3 4.3 8.9-8.9L16 5.9l-7.8 7.8Z" />
          <path d="M13.2 13.7 10 10.5l-1.1 1.1 4.3 4.3 8.9-8.9L21 5.9l-7.8 7.8Z" />
        </svg>
        已完成
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-emerald-700">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
        <path d="M7.7 13.7 4.5 10.5l-1.1 1.1 4.3 4.3L16.6 7l-1.1-1.1-7.8 7.8Z" />
      </svg>
      已发送
    </span>
  );
}

function getUserMessageDeliveryStatus(
  message: MessageView,
  messages: MessageView[],
  expectedAssistantCount: number,
) {
  const nextUserMessage = messages.find(
    (candidate) => candidate.role === "USER" && candidate.sequence > message.sequence,
  );
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
  const [activeAction, setActiveAction] = useState<RoomAction>(null);
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [draftModelIds, setDraftModelIds] = useState<string[]>([]);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "order">("chat");

  const isBusy = activeAction !== null;
  const isSending = activeAction === "sending";
  const showLoadingSkeleton = activeAction === "loading" && !room && messages.length === 0;

  async function loadRoom() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    setRoom(data.room);
    setDraftModelIds(data.room.roomModels.map((roomModel) => roomModel.modelId));
  }

  async function loadMessages() {
    const data = await fetchJson<{ messages: MessageView[] }>(`/api/rooms/${roomId}/messages`);
    setMessages(data.messages);
  }

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

  const orderedModelNames = useMemo(
    () => orderedRoomModels.map((roomModel) => roomModel.model.name),
    [orderedRoomModels],
  );

  const statusText = useMemo(() => {
    if (activeAction === "loading") {
      return "正在加载房间...";
    }

    if (activeAction === "saving-order") {
      return "正在保存模型顺序...";
    }

    if (activeAction === "renaming-room") {
      return "正在更新房间名称...";
    }

    if (activeAction === "deleting-room") {
      return "正在删除房间...";
    }

    if (activeAction === "sending") {
      return orderedModelNames.length > 0
        ? `正在等待 ${orderedModelNames.join(" -> ")} 按顺序回复...`
        : "正在发送消息...";
    }

    return notice || "可以开始聊天，也可以先调整顺序。";
  }, [activeAction, notice, orderedModelNames]);

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    setFeedback(null);

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

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, pendingUserContent, isSending]);

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  function previewMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) {
      return;
    }

    setDraftModelIds((current) => reorderIds(current, draggedModelId, targetId));
    setDragOverModelId(targetId);
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
        body: JSON.stringify({
          modelIds: draftModelIds,
        }),
      });

      setRoom(data.room);
      setDraftModelIds(data.room.roomModels.map((roomModel) => roomModel.modelId));
      setNotice("房间顺序已保存。");
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
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: nextTitle.trim(),
        }),
      });

      setRoom(data.room);
      setDraftModelIds(data.room.roomModels.map((roomModel) => roomModel.modelId));
      setNotice(`房间已改名为「${data.room.title}」。`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteRoom() {
    if (!room) {
      return;
    }

    const shouldDelete = window.confirm(`确认删除房间“${room.title}”吗？聊天记录也会一起删除。`);

    if (!shouldDelete) {
      return;
    }

    setActiveAction("deleting-room");
    setFeedback(null);

    try {
      await fetchJson(`/api/rooms/${room.id}`, {
        method: "DELETE",
      });
      router.push("/rooms");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
      setActiveAction(null);
    }
  }

  function getFailedModelLabel(failedModelId?: string) {
    if (!failedModelId || !room) {
      return "未知模型";
    }

    const failedModel = room.roomModels.find((roomModel) => roomModel.modelId === failedModelId);
    return failedModel?.model.name ?? failedModelId;
  }

  async function sendMessage() {
    if (!room) {
      return;
    }

    const normalizedContent = messageInput.trim();

    if (!normalizedContent) {
      return;
    }

    if (orderDirty) {
      setFeedback({
        title: "请先保存顺序",
        description: "你刚刚调整了右侧模型顺序，但服务端还没有保存。",
        suggestion: "点击“保存排序”后再发送消息，避免本轮执行顺序与页面显示不一致。",
        tone: "warning",
      });
      return;
    }

    setActiveAction("sending");
    setFeedback(null);
    setPendingUserContent(normalizedContent);
    setNotice(
      orderedModelNames.length > 0
        ? `正在等待 ${orderedModelNames.join(" -> ")} 按顺序回复...`
        : "正在发送消息...",
    );

    try {
      const result = await sendRoomMessageRequest(room.id, normalizedContent);
      setMessageInput("");
      setPendingUserContent("");
      await Promise.all([loadMessages(), loadRoom()]);

      if (result.status === "partial") {
        setFeedback(describePartialSendResult(result, getFailedModelLabel(result.failedModelId)));
        setNotice("本轮回复部分完成。");
      } else {
        setNotice("消息已发送，顺序回复完成。");
      }
    } catch (error: unknown) {
      setPendingUserContent("");
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (!messageInput.trim() || isBusy) {
      return;
    }

    startTransition(() => {
      void sendMessage();
    });
  }

  if (showLoadingSkeleton) {
    return <RoomChatSkeleton />;
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] px-5 py-6 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs font-medium tracking-[0.18em] text-[var(--accent)]">
              ROOM DETAIL
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">{room?.title ?? "加载房间中..."}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                聊天页会同时展示消息内容、参与模型的彩色身份标识，以及右侧的实时顺序面板。顺序调整和房间管理都可以直接在这里完成。
              </p>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-[var(--border)] bg-white/75 px-4 py-3 text-sm text-[var(--muted)] lg:w-auto">
            {statusText}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Link
            href="/rooms"
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            返回房间列表
          </Link>
          <Link
            href="/rooms/new"
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            新建房间
          </Link>
          <Link
            href={`/rooms/${roomId}/edit`}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            编辑房间
          </Link>
          <button
            type="button"
            onClick={() => startTransition(() => void renameRoom())}
            disabled={!room || isBusy}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            重命名房间
          </button>
          <button
            type="button"
            onClick={() => startTransition(() => void deleteRoom())}
            disabled={!room || isBusy}
            className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            删除房间
          </button>
        </div>

        {feedback ? <FeedbackPanel feedback={feedback} /> : null}
      </section>

      <section className="xl:hidden">
        <div className="grid grid-cols-2 gap-2 rounded-[1.6rem] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_16px_40px_rgba(17,17,17,0.06)]">
          <button
            type="button"
            onClick={() => setMobilePanel("chat")}
            className={`rounded-[1.1rem] px-4 py-3 text-sm font-medium transition ${
              mobilePanel === "chat"
                ? "bg-[var(--accent)] text-white shadow-[0_12px_24px_rgba(17,17,17,0.08)]"
                : "bg-white/70 text-[var(--muted)]"
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("order")}
            className={`rounded-[1.1rem] px-4 py-3 text-sm font-medium transition ${
              mobilePanel === "order"
                ? "bg-[var(--accent)] text-white shadow-[0_12px_24px_rgba(17,17,17,0.08)]"
                : "bg-white/70 text-[var(--muted)]"
            }`}
          >
            Order
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div
          className={`${mobilePanel === "chat" ? "block" : "hidden"} rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6 xl:block`}
        >
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">聊天区</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {room ? `${toRoomLabel(room.type)} / ${room.roomModels.length} 个模型参与` : "正在读取房间信息"}
              </p>
            </div>
            {room ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
                  已累计 {room.messageCount} 条消息
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
                  最后更新于 {formatDate(room.updatedAt)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-[420px] flex-col rounded-[1.75rem] border border-[var(--border)] bg-white/75 sm:min-h-[560px]">
            <div ref={messageListRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {messages.length === 0 && !pendingUserContent ? (
                <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
                  这个房间还没有消息，可以先发第一条内容试试。
                </p>
              ) : null}

              {messages.map((message) => {
                if (message.role === "USER") {
                  const deliveryStatus = getUserMessageDeliveryStatus(
                    message,
                    messages,
                    room?.roomModels.length ?? 1,
                  );

                  return (
                    <article
                      key={message.id}
                      className="ml-auto max-w-[96%] rounded-[1.6rem] bg-[var(--accent)] px-4 py-3 text-white shadow-[0_12px_24px_rgba(17,17,17,0.06)] sm:max-w-[90%]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-70">
                          <span>{toRoleLabel(message.role)}</span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <MessageDeliveryIndicator status={deliveryStatus} />
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                    </article>
                  );
                }

                const roomModel =
                  room?.roomModels.find((candidate) => candidate.modelId === message.modelId) ?? null;
                const messageModel = roomModel?.model ?? message.model;
                const provider = messageModel?.provider;

                return (
                  <article
                    key={message.id}
                    className={`max-w-[96%] rounded-[1.6rem] px-4 py-3 text-[var(--foreground)] shadow-[0_12px_24px_rgba(17,17,17,0.06)] sm:max-w-[90%] ${
                      provider ? getProviderSoftClassName(provider) : "bg-[rgb(255,252,247)]"
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {provider ? (
                        <>
                          <span
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] ${getProviderIconClassName(
                              provider,
                            )}`}
                          >
                            {getProviderShortName(provider)}
                          </span>
                          <span className="text-sm font-medium">{messageModel?.name ?? "AI"}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(
                              provider,
                            )}`}
                          >
                            {getProviderOptionLabel(provider)}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {formatReplyLength(messageModel?.defaultReplyLength ?? 300)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-medium">AI</span>
                      )}
                      <span className="text-xs text-[var(--muted)]">{formatDate(message.createdAt)}</span>
                    </div>
                    <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      {toRoleLabel(message.role)}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                  </article>
                );
              })}

              {pendingUserContent ? (
                <article className="ml-auto max-w-[96%] rounded-[1.6rem] border border-[var(--accent)] bg-[rgba(191,95,54,0.10)] px-4 py-3 text-[var(--foreground)] shadow-[0_12px_24px_rgba(17,17,17,0.06)] sm:max-w-[90%]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>用户</span>
                    </div>
                    <MessageDeliveryIndicator status="sending" />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7">{pendingUserContent}</p>
                </article>
              ) : null}

              {isSending && room ? (
                <div className="rounded-[1.6rem] border border-dashed border-[var(--border)] bg-[rgba(191,95,54,0.05)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--foreground)]">本轮正在顺序等待回复</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    后续模型会依次看到前面模型本轮已经生成的内容。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {orderedRoomModels.map((roomModel, index) => (
                      <span
                        key={roomModel.id}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(
                          roomModel.model.provider,
                        )}`}
                      >
                        {index + 1}. {roomModel.model.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
              <textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="输入消息并发送，Enter 发送，Shift+Enter 换行..."
                rows={4}
                className="w-full resize-none rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              />
              <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-xs ${orderDirty ? "text-amber-700" : "text-[var(--muted)]"}`}>
                  {orderDirty
                    ? "当前有未保存的顺序调整，请先点右侧“保存排序”，再发送消息。"
                    : "当前按固定顺序发言，并会为每个模型带上默认回复字数限制。"}
                </p>
                <button
                  type="button"
                  onClick={() => startTransition(() => void sendMessage())}
                  disabled={!messageInput.trim() || isBusy}
                  className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto"
                >
                  {isSending ? "等待回复中..." : "发送消息"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className={`${mobilePanel === "order" ? "block" : "hidden"} space-y-6 xl:block`}>
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">模型顺序</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                拖拽卡片就会立即换位，保存时不会再撞到顺序唯一约束。
              </p>
            </div>

            <div
              className={`mb-4 rounded-3xl border px-4 py-3 text-sm ${
                orderDirty
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-[var(--border)] bg-white/70 text-[var(--muted)]"
              }`}
            >
              {orderDirty
                ? "当前顺序有调整，服务端还没有保存。发送消息前请先保存。"
                : "当前顺序已经保存，下一轮回复会严格按照右侧从上到下执行。"}
            </div>

            <div className="space-y-3">
              {orderedRoomModels.map((roomModel, index) => {
                const isDragging = draggedModelId === roomModel.modelId;
                const isDropTarget = dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId;

                return (
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
                      event.dataTransfer.dropEffect = "move";
                      previewMove(roomModel.modelId);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      clearDragState();
                    }}
                    onDragEnd={clearDragState}
                    className={`relative overflow-hidden rounded-[1.7rem] border px-4 py-4 transition-all duration-200 ease-out will-change-transform ${
                      isDragging
                        ? "scale-[1.02] border-[var(--accent)] bg-[rgba(191,95,54,0.14)] shadow-[0_24px_60px_rgba(17,17,17,0.12)]"
                        : isDropTarget
                          ? "translate-x-1 border-[var(--accent)] bg-[rgba(191,95,54,0.10)] shadow-[0_18px_40px_rgba(17,17,17,0.10)]"
                          : "border-[var(--border)] bg-white/80"
                    } ${
                      orderedRoomModels.length > 1 && !isBusy
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-default opacity-100"
                    }`}
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
                            roomModel.model.provider,
                          )}`}
                        >
                          {getProviderShortName(roomModel.model.provider)}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)]">
                              {index + 1}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(
                                roomModel.model.provider,
                              )}`}
                            >
                              {getProviderShortName(roomModel.model.provider)}
                            </span>
                          </div>
                          <p className="mt-2 font-medium">{roomModel.model.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {getProviderOptionLabel(roomModel.model.provider)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            默认回复字数：{formatReplyLength(roomModel.model.defaultReplyLength)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {orderedRoomModels.length > 1 ? "拖拽即可换位" : "单聊"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => startTransition(() => void saveOrder())}
              disabled={!orderDirty || isBusy}
              className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {activeAction === "saving-order" ? "正在保存..." : "保存排序"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
