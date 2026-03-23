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
  countAssistantRepliesForUserMessage,
  describeClientError,
  describePartialSendResult,
  findNextUserMessageAfterSequence,
  fetchJson,
  formatDate,
  formatReplyLength,
  getProviderBadgeClassName,
  getProviderIconClassName,
  getProviderOptionLabel,
  getProviderShortName,
  getProviderSoftClassName,
  getUserMessageRoundStatus,
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
type PendingRoundState = {
  baselineSequence: number;
  userSequence: number | null;
  completedAssistantCount: number;
  expectedAssistantCount: number;
};

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
      <p className="mt-2 text-sm leading-6 opacity-90">Suggestion: {feedback.suggestion}</p>
    </div>
  );
}

function DeliveryBadge({ text, className }: { text: string; className: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{text}</span>;
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
  const [pendingRound, setPendingRound] = useState<PendingRoundState | null>(null);
  const [draftModelIds, setDraftModelIds] = useState<string[]>([]);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "order">("chat");

  const isBusy = activeAction !== null;
  const isSending = activeAction === "sending";

  async function fetchRoomState() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    return data.room;
  }

  async function loadRoom() {
    const nextRoom = await fetchRoomState();
    setRoom(nextRoom);
    setDraftModelIds(nextRoom.roomModels.map((roomModel) => roomModel.modelId));
    return nextRoom;
  }

  async function fetchMessagesState() {
    const data = await fetchJson<{ messages: MessageView[] }>(`/api/rooms/${roomId}/messages`);
    return data.messages;
  }

  async function loadMessages() {
    const nextMessages = await fetchMessagesState();
    setMessages(nextMessages);
    return nextMessages;
  }

  function syncPendingRoundFromMessages(nextMessages: MessageView[], baselineSequence: number, expectedAssistantCount: number) {
    const persistedUserMessage = findNextUserMessageAfterSequence(nextMessages, baselineSequence);
    const completedAssistantCount = persistedUserMessage
      ? countAssistantRepliesForUserMessage(nextMessages, persistedUserMessage.sequence)
      : 0;

    setPendingRound({
      baselineSequence,
      userSequence: persistedUserMessage?.sequence ?? null,
      completedAssistantCount,
      expectedAssistantCount,
    });

    if (persistedUserMessage) {
      setPendingUserContent("");
    }

    setNotice(`Waiting for AI replies: ${completedAssistantCount}/${expectedAssistantCount}`);
  }

  async function watchSequentialReplies(
    baselineSequence: number,
    expectedAssistantCount: number,
    requestPromise: Promise<unknown>,
  ) {
    let settled = false;
    void requestPromise.finally(() => {
      settled = true;
    });

    while (!settled) {
      try {
        const nextMessages = await fetchMessagesState();
        setMessages(nextMessages);
        syncPendingRoundFromMessages(nextMessages, baselineSequence, expectedAssistantCount);
      } catch {
        // Ignore intermittent polling errors while the primary send request is still running.
      }

      if (!settled) {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    try {
      await Promise.all([loadRoom(), loadMessages()]);
      setNotice("Room loaded.");
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

  const pendingModel = useMemo(() => {
    if (!pendingRound || !isSending) {
      return null;
    }

    if (pendingRound.completedAssistantCount >= pendingRound.expectedAssistantCount) {
      return null;
    }

    return orderedRoomModels[pendingRound.completedAssistantCount] ?? null;
  }, [isSending, orderedRoomModels, pendingRound]);

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
      setNotice("Order saved.");
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

    const nextTitle = window.prompt("Enter a new room name:", room.title);
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
      setNotice(`Room renamed to "${data.room.title}".`);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteRoom() {
    if (!room || !window.confirm(`Delete room "${room.title}"?`)) {
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
        title: "Save the order first",
        description: "You changed the model order, but the server has not saved it yet.",
        suggestion: "Save the order in the right panel before sending the next message.",
        tone: "warning",
      });
      return;
    }

    const normalizedContent = messageInput.trim();
    const baselineSequence = messages.at(-1)?.sequence ?? 0;
    const expectedAssistantCount = room.roomModels.length;
    setActiveAction("sending");
    setMessageInput("");
    setPendingUserContent(normalizedContent);
    setFeedback(null);
    setPendingRound({
      baselineSequence,
      userSequence: null,
      completedAssistantCount: 0,
      expectedAssistantCount,
    });
    setNotice(`Waiting for AI replies: 0/${expectedAssistantCount}`);

    try {
      const requestPromise = sendRoomMessageRequest(room.id, normalizedContent);
      await watchSequentialReplies(baselineSequence, expectedAssistantCount, requestPromise);
      const result = await requestPromise;
      await Promise.all([loadMessages(), loadRoom()]);
      setPendingRound(null);
      setPendingUserContent("");

      if (result.status === "partial") {
        const failedModel =
          room.roomModels.find((roomModel) => roomModel.modelId === result.failedModelId)?.model.name ?? "Unknown model";
        setFeedback(describePartialSendResult(result, failedModel));
        setNotice("This round completed partially.");
      } else {
        setNotice("Message sent. This round is complete.");
      }
    } catch (error: unknown) {
      setMessageInput(normalizedContent);
      setPendingUserContent("");
      setPendingRound(null);
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
            <h1 className="text-4xl font-semibold tracking-tight">{room?.title ?? "Loading room..."}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              This workspace keeps model identity, delivery state, and speaking order visible while you chat.
            </p>
            {room ? (
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-[var(--border)] bg-white/82 px-3 py-2 text-[var(--muted)]">
                  {toRoomLabel(room.type)}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white/82 px-3 py-2 text-[var(--muted)]">
                  {room.roomModels.length} models participating
                </span>
                <span className="rounded-full border border-[var(--border)] bg-white/82 px-3 py-2 text-[var(--muted)]">
                  Messages: {room.messageCount}
                </span>
              </div>
            ) : null}
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/82 px-4 py-3 text-sm text-[var(--muted)]">
            {notice || "Start chatting, or adjust the model order before sending."}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Link href="/rooms" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)]">Back to rooms</Link>
          <Link href="/rooms/new" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)]">New room</Link>
          <Link href={`/rooms/${roomId}/edit`} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)]">Edit room</Link>
          <button type="button" onClick={() => startTransition(() => void renameRoom())} disabled={!room || isBusy} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] disabled:opacity-60">Rename room</button>
          <button type="button" onClick={() => startTransition(() => void deleteRoom())} disabled={!room || isBusy} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm text-red-600 disabled:opacity-60">Delete room</button>
        </div>
      </section>

      <FeedbackPanel feedback={feedback} />

      <section className="xl:hidden">
        <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] border border-[var(--border)] bg-[var(--card)] p-2">
          <button type="button" onClick={() => setMobilePanel("chat")} className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${mobilePanel === "chat" ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted)]"}`}>Chat</button>
          <button type="button" onClick={() => setMobilePanel("order")} className={`rounded-[1rem] px-4 py-3 text-sm font-medium ${mobilePanel === "order" ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted)]"}`}>Order</button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <div className={`${mobilePanel === "chat" ? "block" : "hidden"} rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6 xl:block`}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Chat</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{room ? `${toRoomLabel(room.type)} / Updated ${formatDate(room.updatedAt)}` : "Loading room details"}</p>
            </div>
          </div>

          <div className="flex min-h-[420px] flex-col rounded-[1.8rem] border border-[var(--border)] bg-white/75 sm:min-h-[560px]">
            <div ref={messageListRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {messages.map((message) => {
                if (message.role === "USER") {
                  const status = getUserMessageRoundStatus({
                    message,
                    messages,
                    expectedAssistantCount: room?.roomModels.length ?? 1,
                    pendingRoundUserSequence: pendingRound?.userSequence,
                    sendInProgress: isSending,
                  });
                  const badge =
                    status === "completed"
                      ? <DeliveryBadge text="Completed" className="border-emerald-200 bg-emerald-50 text-emerald-700" />
                      : status === "partial"
                        ? <DeliveryBadge text="Partial" className="border-amber-200 bg-amber-50 text-amber-700" />
                        : <DeliveryBadge text="Delivered" className="border-emerald-200 bg-emerald-50 text-emerald-700" />;

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
                    <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">User</span>
                    <DeliveryBadge text="Sending" className="border-zinc-200 bg-white/80 text-zinc-500" />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7">{pendingUserContent}</p>
                </article>
              ) : null}

              {pendingModel ? (
                <article className={`max-w-[96%] rounded-[1.7rem] border border-dashed px-4 py-4 shadow-[0_12px_24px_rgba(17,17,17,0.04)] sm:max-w-[90%] ${getProviderSoftClassName(pendingModel.model.provider)}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] ${getProviderIconClassName(pendingModel.model.provider)}`}>{getProviderShortName(pendingModel.model.provider)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{pendingModel.model.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(pendingModel.model.provider)}`}>{getProviderOptionLabel(pendingModel.model.provider)}</span>
                        <DeliveryBadge text={`${pendingRound?.completedAssistantCount ?? 0}/${pendingRound?.expectedAssistantCount ?? room?.roomModels.length ?? 0}`} className="border-sky-200 bg-sky-50 text-sky-700" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{`Current turn: ${pendingModel.model.name} is replying.`}</p>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>

            <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
              <textarea value={messageInput} onChange={(event) => setMessageInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Type a message. Enter sends, Shift+Enter adds a new line..." rows={4} className="w-full resize-none rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]" />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-xs ${orderDirty ? "text-amber-700" : "text-[var(--muted)]"}`}>{orderDirty ? "You have unsaved order changes. Save them before sending." : "Replies will follow the saved order and each model will keep its own reply-length limit."}</p>
                <button type="button" onClick={() => startTransition(() => void sendMessage())} disabled={!messageInput.trim() || isBusy} className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto">{isSending ? "Waiting for replies..." : "Send message"}</button>
              </div>
            </div>
          </div>
        </div>

        <aside className={`${mobilePanel === "order" ? "block" : "hidden"} space-y-6 xl:block`}>
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:p-6">
            <h2 className="text-2xl font-semibold">Model order</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Drag the cards to reorder them. The next round will follow the saved order from top to bottom.</p>
            <div className={`mt-4 rounded-3xl border px-4 py-3 text-sm ${orderDirty ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[var(--border)] bg-white/70 text-[var(--muted)]"}`}>{orderDirty ? "The order changed locally and is not saved on the server yet." : "The current order is already saved."}</div>

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
                      <p className="mt-1 text-xs text-[var(--muted)]">{formatReplyLength(roomModel.model.defaultReplyLength)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => startTransition(() => void saveOrder())} disabled={!orderDirty || isBusy} className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300">{activeAction === "saving-order" ? "Saving..." : "Save order"}</button>
          </div>
        </aside>
      </section>
    </main>
  );
}
