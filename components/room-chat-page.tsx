"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, type KeyboardEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  countAssistantRepliesForUserMessage,
  describeClientError,
  describePartialSendResult,
  fetchJson,
  findNextUserMessageAfterSequence,
  formatDate,
  formatReplyLength,
  getProviderBadgeClassName,
  getProviderIconClassName,
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

type OrderedRoomModel = RoomView["roomModels"][number];

/* ─── Small sub-components ─── */

function FeedbackPanel({ feedback, onDismiss }: { feedback: ClientErrorFeedback | null; onDismiss: () => void }) {
  if (!feedback) return null;

  const toneClass =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : "border-red-200 bg-red-50/90 text-red-900";

  return (
    <div className={`animate-chat-in mx-auto max-w-3xl rounded-xl border px-4 py-2.5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{feedback.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed opacity-90">{feedback.description}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed opacity-75">建议：{feedback.suggestion}</p>
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 rounded-md p-1 text-current opacity-50 transition hover:opacity-100">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

function TypingIndicator({ modelName }: { modelName: string | null }) {
  return (
    <div className="animate-chat-in flex items-center gap-3 px-1">
      <div className="flex items-center gap-1.5 rounded-xl bg-white/60 px-3.5 py-2.5 shadow-sm backdrop-blur-sm border border-white/30">
        <div className="flex items-center gap-1 mr-2">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </div>
        <span className="text-[12px] font-medium text-[var(--muted)]">
          {modelName ? `${modelName} 正在回复...` : "正在等待回复..."}
        </span>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function RoomChatPage({ roomId }: RoomChatPageProps) {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [pendingUserContent, setPendingUserContent] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [activeAction, setActiveAction] = useState<RoomAction>("loading");
  const [pendingRound, setPendingRound] = useState<PendingRoundState | null>(null);
  const [draftModelIds, setDraftModelIds] = useState<string[]>([]);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);

  const isBusy = activeAction !== null;
  const isSending = activeAction === "sending";

  /* ─── Data loading ─── */

  async function loadRoom() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    setRoom(data.room);
    setDraftModelIds(data.room.roomModels.map((item) => item.modelId));
    return data.room;
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

  function syncPendingRound(nextMessages: MessageView[], baselineSequence: number, expectedAssistantCount: number) {
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

    if (persistedUserMessage) setPendingUserContent("");
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
        syncPendingRound(nextMessages, baselineSequence, expectedAssistantCount);
      } catch {}

      if (!settled) {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }
  }

  const handleInitialLoad = useEffectEvent(async () => {
    setActiveAction("loading");
    try {
      await Promise.all([loadRoom(), loadMessages()]);
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
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingUserContent, isSending]);

  /* ─── Derived state ─── */

  const orderedRoomModels = useMemo(() => {
    if (!room) return [];
    return draftModelIds
      .map((modelId) => room.roomModels.find((roomModel) => roomModel.modelId === modelId))
      .filter((roomModel): roomModel is RoomView["roomModels"][number] => Boolean(roomModel));
  }, [draftModelIds, room]);

  const orderDirty = useMemo(() => {
    if (!room) return false;
    return room.roomModels.map((item) => item.modelId).join(",") !== draftModelIds.join(",");
  }, [draftModelIds, room]);

  const activeTimelineModel = useMemo(() => {
    if (!pendingRound || !isSending) return null;
    const total = Math.min(pendingRound.expectedAssistantCount, orderedRoomModels.length);
    const activeIndex = pendingRound.completedAssistantCount;
    if (activeIndex >= total) return null;
    return orderedRoomModels[activeIndex]?.model ?? null;
  }, [isSending, orderedRoomModels, pendingRound]);

  /* ─── Actions ─── */

  function previewMove(targetId: string) {
    if (!draggedModelId || draggedModelId === targetId) return;
    setDraftModelIds((current) => reorderIds(current, draggedModelId, targetId));
    setDragOverModelId(targetId);
  }

  function clearDragState() {
    setDraggedModelId(null);
    setDragOverModelId(null);
  }

  async function saveOrder() {
    if (!room || !orderDirty) return;
    setActiveAction("saving-order");
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}/order`, {
        method: "PUT",
        body: JSON.stringify({ modelIds: draftModelIds }),
      });
      setRoom(data.room);
      setDraftModelIds(data.room.roomModels.map((item) => item.modelId));
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function renameRoom() {
    if (!room) return;
    const nextTitle = window.prompt("请输入新的房间名称：", room.title);
    if (!nextTitle || nextTitle.trim() === room.title) return;

    setActiveAction("renaming-room");
    setFeedback(null);

    try {
      const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${room.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: nextTitle.trim() }),
      });
      setRoom(data.room);
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteRoom() {
    if (!room || !window.confirm(`确认删除房间「${room.title}」吗？`)) return;
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
    if (!room || !messageInput.trim()) return;

    if (orderDirty) {
      setFeedback({
        title: "请先保存排序",
        description: "你刚刚调整了模型顺序，但还没有保存到服务端。",
        suggestion: "请先保存排序后再发送消息。",
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
    setPendingRound({ baselineSequence, userSequence: null, completedAssistantCount: 0, expectedAssistantCount });

    try {
      const requestPromise = sendRoomMessageRequest(room.id, normalizedContent);
      await watchSequentialReplies(baselineSequence, expectedAssistantCount, requestPromise);
      const result = await requestPromise;
      await Promise.all([loadMessages(), loadRoom()]);
      setPendingRound(null);
      setPendingUserContent("");

      if (result.status === "partial") {
        const failedModel = room.roomModels.find((item) => item.modelId === result.failedModelId)?.model.name ?? "未知模型";
        setFeedback(describePartialSendResult(result, failedModel));
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

  function autoResizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  /* ─── Loading skeleton ─── */

  if (activeAction === "loading" && !room) {
    return (
      <main className="flex h-dvh flex-col">
        <div className="flex items-center gap-3 border-b border-white/20 px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded-lg bg-white/30" />
          <div className="h-5 w-20 animate-pulse rounded-lg bg-white/30" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="typing-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
            </div>
            <p className="text-sm text-[var(--muted)]">加载聊天室中...</p>
          </div>
        </div>
      </main>
    );
  }

  /* ─── Status bar text ─── */

  const statusText = isSending
    ? `正在回复 ${pendingRound?.completedAssistantCount ?? 0}/${pendingRound?.expectedAssistantCount ?? 0}`
    : `${room?.roomModels.length ?? 0} 个模型 · ${toRoomLabel(room?.type ?? "SINGLE")}`;

  /* ─── Render ─── */

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      {/* ─ Top toolbar ─ */}
      <div className="ly-slim-bar mx-2 mt-1.5 flex items-center justify-between gap-3 rounded-xl px-3 py-2 sm:mx-4 sm:mt-2 sm:rounded-2xl sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/rooms" className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] active:scale-95" title="返回房间列表">
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-bold tracking-tight sm:text-[16px]">{room?.title ?? "加载中..."}</h1>
            <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--muted)] sm:text-[11px]">{statusText}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isSending && (
            <div className="mr-1.5 flex items-center gap-1">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSidePanel(!showSidePanel)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${showSidePanel ? "bg-[var(--accent)] text-white" : "bg-black/5 text-[var(--muted)] hover:bg-black/10"}`}
            title="模型顺序"
          >
            <span className="hidden sm:inline">{room?.roomModels.length ?? 0} 模型</span>
            <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button type="button" onClick={() => startTransition(() => void renameRoom())} disabled={!room || isBusy} className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] active:scale-95 disabled:opacity-30" title="重命名">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <Link href={`/rooms/${roomId}/edit`} className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] active:scale-95" title="设置">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </Link>
          <button type="button" onClick={() => startTransition(() => void deleteRoom())} disabled={!room || isBusy} className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-30" title="删除">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* ─ Main content area ─ */}
      <div className="flex min-h-0 flex-1">
        {/* ─ Chat column ─ */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Feedback */}
          {feedback && (
            <div className="px-3 pt-1.5 sm:px-4">
              <FeedbackPanel feedback={feedback} onDismiss={() => setFeedback(null)} />
            </div>
          )}

          {/* Order dirty warning */}
          {orderDirty && (
            <div className="animate-chat-in mx-auto mt-1.5 flex max-w-3xl items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/80 px-3.5 py-1.5">
              <span className="text-[12px] font-medium text-amber-700">模型顺序已调整但还未保存</span>
              <button
                type="button"
                onClick={() => startTransition(() => void saveOrder())}
                disabled={isBusy}
                className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-amber-600 active:scale-95 disabled:opacity-40"
              >
                {activeAction === "saving-order" ? "保存中..." : "保存"}
              </button>
            </div>
          )}

          {/* ─ Message list ─ */}
          <div ref={messageListRef} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">
            <div className="mx-auto max-w-3xl space-y-4">
              {/* Empty state */}
              {messages.length === 0 && !pendingUserContent && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center gap-2 rounded-xl bg-white/40 px-4 py-2.5 backdrop-blur-sm border border-white/30">
                    <div className="flex -space-x-2">
                      {orderedRoomModels.slice(0, 3).map((rm) => (
                        <span key={rm.id} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[8px] font-bold ring-2 ring-white ${getProviderIconClassName(rm.model.provider)}`}>
                          {getProviderShortName(rm.model.provider)}
                        </span>
                      ))}
                    </div>
                    <span className="text-[12px] font-medium text-[var(--muted)]">
                      {orderedRoomModels.length} 个模型就绪
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">开始你的对话</h2>
                  <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--muted)]">
                    发送一条消息，模型会按配置好的顺序依次回复。
                  </p>
                </div>
              )}

              {/* Messages */}
              {messages.map((message) => {
                if (message.role === "USER") {
                  return (
                    <article key={message.id} className="animate-chat-in flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[75%]">
                        <div className="rounded-2xl rounded-tr-md bg-[linear-gradient(135deg,#993c50,#c7576f)] px-4 py-3 text-white shadow-md sm:px-5 sm:py-3.5">
                          <p className="whitespace-pre-wrap text-[14px] leading-[1.75] sm:text-[15px]">{message.content}</p>
                        </div>
                        <p className="mt-1 text-right text-[10px] text-[var(--muted)] opacity-60">{formatDate(message.createdAt)}</p>
                      </div>
                    </article>
                  );
                }

                const roomModel = room?.roomModels.find((candidate) => candidate.modelId === message.modelId) ?? null;
                const messageModel = roomModel?.model ?? message.model;
                const provider = messageModel?.provider;

                return (
                  <article key={message.id} className="animate-chat-in flex justify-start">
                    <div className="max-w-[85%] sm:max-w-[75%]">
                      <div className="flex items-center gap-1.5 mb-1">
                        {provider && (
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[7px] font-bold tracking-wide ${getProviderIconClassName(provider)}`}>
                            {getProviderShortName(provider)}
                          </span>
                        )}
                        <span className="text-[12px] font-semibold tracking-tight">{messageModel?.name ?? "AI 助手"}</span>
                      </div>
                      <div className={`rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm sm:px-5 sm:py-3.5 ${provider ? `${getProviderSoftClassName(provider)} border-white/40` : "border-white/30 bg-white/60"}`}>
                        <p className="whitespace-pre-wrap text-[14px] leading-[1.8] text-[var(--foreground)] sm:text-[15px]">{message.content}</p>
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--muted)] opacity-60">{formatDate(message.createdAt)}</p>
                    </div>
                  </article>
                );
              })}

              {/* Pending user message */}
              {pendingUserContent && (
                <article className="animate-chat-in flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <div className="rounded-2xl rounded-tr-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 sm:px-5 sm:py-3.5">
                      <p className="whitespace-pre-wrap text-[14px] leading-[1.75] opacity-60 sm:text-[15px]">{pendingUserContent}</p>
                    </div>
                    <p className="mt-1 text-right text-[10px] text-[var(--muted)] opacity-40">发送中...</p>
                  </div>
                </article>
              )}

              {/* Typing indicator */}
              {isSending && <TypingIndicator modelName={activeTimelineModel?.name ?? null} />}
            </div>
          </div>

          {/* ─ Input area ─ */}
          <div className="border-t border-white/15 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-4 sm:pt-3">
            <div className="ly-chat-input mx-auto max-w-3xl rounded-xl px-3.5 py-2 sm:rounded-2xl sm:px-4 sm:py-2.5">
              <textarea
                ref={textareaRef}
                value={messageInput}
                onChange={(event) => {
                  setMessageInput(event.target.value);
                  autoResizeTextarea();
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder="输入消息，回车发送（Shift+回车换行）"
                rows={1}
                className="max-h-40 w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-[var(--muted)]/50 sm:text-[15px]"
                style={{ height: "auto" }}
                disabled={isBusy && !isSending}
              />
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSending && pendingRound && (
                    <span className="text-[11px] font-medium text-[var(--accent)]">
                      ⏳ {pendingRound.completedAssistantCount}/{pendingRound.expectedAssistantCount} 已完成
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startTransition(() => void sendMessage())}
                  disabled={!messageInput.trim() || isBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-white transition-all hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isSending ? (
                    <>
                      <span className="flex items-center gap-0.5">
                        <span className="typing-dot h-1 w-1 rounded-full bg-white" />
                        <span className="typing-dot h-1 w-1 rounded-full bg-white" />
                        <span className="typing-dot h-1 w-1 rounded-full bg-white" />
                      </span>
                      等待中
                    </>
                  ) : (
                    <>
                      发送
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─ Side panel (collapsible) ─ */}
        {showSidePanel && (
          <aside className="animate-slide-in w-64 shrink-0 border-l border-white/15 overflow-y-auto bg-white/20 backdrop-blur-xl p-3 xl:w-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold tracking-tight">模型顺序</h3>
              <button type="button" onClick={() => setShowSidePanel(false)} className="rounded-md p-1 text-[var(--muted)] transition hover:bg-black/5 active:scale-95">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--muted)] mb-3">拖拽调整顺序。下一轮会按保存后的顺序执行。</p>

            {orderDirty && (
              <div className="mb-2 rounded-lg border border-amber-200/60 bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                顺序已修改，尚未保存
              </div>
            )}

            <div className="space-y-1.5">
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
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 transition-all cursor-grab active:cursor-grabbing ${
                    dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-white/30 bg-white/40 hover:bg-white/60"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-[var(--muted)] bg-[var(--foreground)]/8">
                    {index + 1}
                  </span>
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[8px] font-bold tracking-wide ${getProviderIconClassName(roomModel.model.provider)}`}>
                    {getProviderShortName(roomModel.model.provider)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{roomModel.model.name}</p>
                    <p className="text-[10px] text-[var(--muted)]">{formatReplyLength(roomModel.model.defaultReplyLength)}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => startTransition(() => void saveOrder())}
              disabled={!orderDirty || isBusy}
              className="mt-3 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {activeAction === "saving-order" ? "保存中..." : "保存排序"}
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
