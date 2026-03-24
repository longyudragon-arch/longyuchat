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
  getProviderSoftClassName,
  getProviderShortName,
  reorderIds,
  sendRoomMessageRequest,
  toRoomLabel,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import type { MessageView, ProviderType, RoomView } from "@/types/app";

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

function getProviderMessageSurfaceClassName(provider?: ProviderType) {
  switch (provider) {
    case "OPENAI_COMPATIBLE":
      return "border-emerald-200/70 shadow-[0_10px_28px_rgba(16,185,129,0.08)]";
    case "CLAUDE":
      return "border-amber-200/80 shadow-[0_10px_28px_rgba(245,158,11,0.08)]";
    case "GEMINI":
      return "border-sky-200/80 shadow-[0_10px_28px_rgba(14,165,233,0.08)]";
    case "GROK":
      return "border-violet-200/80 shadow-[0_10px_28px_rgba(139,92,246,0.08)]";
    case "DOUBAO":
      return "border-orange-200/80 shadow-[0_10px_28px_rgba(249,115,22,0.08)]";
    case "DEEPSEEK":
      return "border-cyan-200/80 shadow-[0_10px_28px_rgba(6,182,212,0.08)]";
    case "MODELSCOPE":
      return "border-fuchsia-200/80 shadow-[0_10px_28px_rgba(217,70,239,0.08)]";
    case "HUNYUAN":
      return "border-rose-200/80 shadow-[0_10px_28px_rgba(244,63,94,0.08)]";
    case "QWEN":
      return "border-indigo-200/80 shadow-[0_10px_28px_rgba(99,102,241,0.08)]";
    default:
      return "border-stone-200/70 shadow-[0_8px_24px_rgba(0,0,0,0.03)]";
  }
}

function getProviderAccentClassName(provider?: ProviderType) {
  switch (provider) {
    case "OPENAI_COMPATIBLE":
      return "bg-emerald-500";
    case "CLAUDE":
      return "bg-amber-500";
    case "GEMINI":
      return "bg-sky-500";
    case "GROK":
      return "bg-violet-500";
    case "DOUBAO":
      return "bg-orange-500";
    case "DEEPSEEK":
      return "bg-cyan-500";
    case "MODELSCOPE":
      return "bg-fuchsia-500";
    case "HUNYUAN":
      return "bg-rose-500";
    case "QWEN":
      return "bg-indigo-500";
    default:
      return "bg-stone-400";
  }
}

/* ─── Small sub-components ─── */

function FeedbackPanel({ feedback, onDismiss }: { feedback: ClientErrorFeedback | null; onDismiss: () => void }) {
  if (!feedback) return null;

  const toneClass =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : "border-red-200 bg-red-50/90 text-red-900";

  return (
    <div className={`ly-surface-card animate-chat-in mx-auto max-w-3xl px-4 py-2.5 ${toneClass}`}>
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

function DeleteConfirmModal({ roomTitle, onConfirm, onCancel }: { roomTitle: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="ly-surface-card animate-chat-in mx-4 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </span>
          <h3 className="text-[15px] font-bold tracking-tight">删除房间</h3>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          确定要删除房间「<span className="font-bold text-[var(--foreground)]">{roomTitle}</span>」吗？
        </p>
        <p className="mt-1 text-[12px] font-medium text-red-500">删除后不可恢复，房间内的所有聊天记录也会一起删除。</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-[13px] font-bold text-[var(--muted)] transition hover:bg-white active:scale-95">取消</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-600 active:scale-95">确认删除</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export function RoomChatPage({ roomId }: RoomChatPageProps) {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [pendingUserContent, setPendingUserContent] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [activeAction, setActiveAction] = useState<RoomAction>("loading");
  const [pendingRound, setPendingRound] = useState<PendingRoundState | null>(null);
  const [draftModelIds, setDraftModelIds] = useState<string[]>([]);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (messageListRef.current && isNearBottomRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
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
    if (!room) return;
    setShowDeleteConfirm(false);
    setShowMoreMenu(false);
    setActiveAction("deleting-room");

    try {
      await fetchJson(`/api/rooms/${room.id}`, { method: "DELETE" });
      router.push("/rooms");
    } catch (error: unknown) {
      setFeedback(describeClientError(error));
      setActiveAction(null);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isSending || !room) return;

    if (orderDirty) {
      setFeedback({
        title: "请先保存排序",
        description: "你刚刚调整了模型顺序，但还没有保存到服务端。",
        suggestion: "请先保存排序后再发送消息。",
        tone: "warning",
      });
      return;
    }

    const content = input.trim();
    setInput("");
    setPendingUserContent(content);
    isNearBottomRef.current = true;
    const baselineSequence = messages.at(-1)?.sequence ?? 0;
    const expectedAssistantCount = room.roomModels.length;

    setActiveAction("sending");
    setFeedback(null);
    setPendingRound({ baselineSequence, userSequence: null, completedAssistantCount: 0, expectedAssistantCount });

    try {
      const requestPromise = sendRoomMessageRequest(room.id, content);
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
      setInput(content);
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
        startTransition(() => void sendMessage({ preventDefault: () => {} } as React.FormEvent));
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
    <main className="ly-shell h-[calc(100dvh-0.75rem)] py-3 text-[#2f2e33] sm:h-[calc(100dvh-1.25rem)] sm:py-4">
      <div className="ly-glass flex h-full flex-col overflow-hidden rounded-[1.75rem] border-white/40 sm:rounded-[2rem]">
      {/* ─ Top toolbar ─ */}
      <header className="h-16 shrink-0 z-40 border-b border-white/35 bg-white/35 px-4 backdrop-blur-2xl sm:px-6">
        <div className="ly-reading-wrap flex h-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/rooms" className="ly-icon-button shrink-0 rounded-xl bg-[#FF8DA1]/10 text-[#DC75A5] hover:bg-white/40" title="返回房间列表">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-extrabold tracking-tight text-[#DC75A5] sm:text-[17px]">{room?.title ?? "加载中..."}</h1>
              <p className="truncate text-[11px] font-medium text-stone-500 sm:text-[12px]">{statusText}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSending && (
              <div className="mr-2 hidden items-center gap-1 sm:flex">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#DC75A5]" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#DC75A5]" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#DC75A5]" />
              </div>
            )}

            <div className="relative block">
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="ly-icon-button text-stone-600 hover:bg-stone-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>
              </button>
              {showMoreMenu && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); setShowMoreMenu(false); }}></div>
                   <div className="ly-menu-panel absolute right-0 top-full z-50 mt-2 w-48 py-2 animate-chat-in">
                      <button type="button" onClick={() => { setShowMoreMenu(false); setShowSidePanel(!showSidePanel); }} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-[#2f2e33] hover:bg-stone-50">
                        <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg> 模型顺序
                      </button>
                      <button type="button" onClick={() => { setShowMoreMenu(false); startTransition(() => void renameRoom()); }} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-[#2f2e33] hover:bg-stone-50">
                        <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> 重命名
                      </button>
                      <Link href={`/rooms/${roomId}/edit`} onClick={() => setShowMoreMenu(false)} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-[#2f2e33] hover:bg-stone-50">
                         <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> 编辑房间
                      </Link>
                      <div className="my-1 border-t border-stone-100"></div>
                      <button type="button" onClick={() => { setShowMoreMenu(false); setShowDeleteConfirm(true); }} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> 删除
                      </button>
                   </div>
                 </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─ Delete confirmation modal ─ */}
      {showDeleteConfirm && room && (
        <DeleteConfirmModal
          roomTitle={room.title}
          onConfirm={() => startTransition(() => void deleteRoom())}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* ─ Main Workspace ─ */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* Chat Area */}
        <section className="flex-1 flex flex-col min-w-0 bg-transparent z-10 relative">
          
          {feedback && (
            <div className="absolute top-4 left-0 right-0 z-20 px-4 flex justify-center pointer-events-none">
              <div className="pointer-events-auto shadow-lg"><FeedbackPanel feedback={feedback} onDismiss={() => setFeedback(null)} /></div>
            </div>
          )}
          
          {orderDirty && (
            <div className="absolute top-4 left-0 right-0 z-10 px-4 flex justify-center pointer-events-none">
              <div className="ly-soft-card pointer-events-auto animate-chat-in flex items-center gap-3 border-[#FF8DA1]/50 bg-white/80 px-4 py-2 shadow-sm">
                <span className="text-[12px] font-bold text-[#DC75A5]">模型顺序已修改，请保存后再发送</span>
                <button
                  type="button"
                  onClick={() => startTransition(() => void saveOrder())}
                  disabled={isBusy}
                  className="ly-primary-action rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-50"
                >
                  {activeAction === "saving-order" ? "保存中..." : "保存设置"}
                </button>
              </div>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div 
            ref={messageListRef}
            className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 pb-4 space-y-8 scrollbar-thin scrollbar-thumb-stone-300"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              isNearBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
            }}
          >
            <div className="ly-reading-wrap space-y-10">
               {/* Empty chat state */}
               {messages.length === 0 && !pendingUserContent && (
                 <div className="flex flex-col items-center justify-center py-24 text-center">
                   <div className="ly-surface-card mb-6 flex h-16 w-16 items-center justify-center rounded-3xl">
                      <svg className="w-8 h-8 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                   </div>
                   <h2 className="text-2xl font-extrabold text-[#2f2e33] tracking-tight">开始多模型排演</h2>
                   <p className="mt-3 max-w-sm text-sm text-stone-500 leading-relaxed font-medium">
                     发送消息，配置的 {orderedRoomModels.length} 个模型将依次分析并回复。
                   </p>
                 </div>
               )}

               {messages.map((message) => {
                  if (message.role === "USER") {
                     return (
                       <article key={message.id} className="flex flex-col items-end gap-2 max-w-[85%] sm:max-w-2xl ml-auto animate-chat-in">
                         <div className="flex items-center gap-2 px-1">
                           <span className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">{formatDate(message.createdAt)}</span>
                           <span className="px-2.5 py-0.5 rounded-full bg-[#FF8DA1]/20 text-[10px] font-extrabold text-[#DC75A5] tracking-wider uppercase">用户</span>
                         </div>
                         <div className="bg-gradient-to-br from-[#DC75A5] to-[#FF8DA1] p-4 sm:p-5 rounded-3xl rounded-tr-md text-white shadow-xl shadow-[rgba(220,117,165,0.15)]">
                           <p className="whitespace-pre-wrap text-[14px] sm:text-[15px] leading-relaxed break-words">{message.content}</p>
                         </div>
                       </article>
                     );
                  }

                  const roomModel = room?.roomModels.find((candidate) => candidate.modelId === message.modelId) ?? null;
                  const messageModel = roomModel?.model ?? message.model;
                  const provider = messageModel?.provider;
                  const providerSurfaceClassName = getProviderMessageSurfaceClassName(provider);
                  const providerSoftClassName = provider ? getProviderSoftClassName(provider) : "bg-stone-50/80";
                  const providerBadgeClassName = provider
                    ? getProviderBadgeClassName(provider)
                    : "border-stone-200 bg-stone-50 text-stone-600";

                  return (
                     <article key={message.id} className="flex flex-col items-start gap-2 max-w-[90%] sm:max-w-3xl animate-chat-in">
                        <div className="flex items-center gap-2 px-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-[#2f2e33] tracking-wider uppercase flex items-center gap-1.5 shadow-sm border ${providerBadgeClassName}`}>
                            {provider && (
                              <span className={`inline-flex items-center justify-center rounded text-[8px] font-bold ${getProviderIconClassName(provider)}`}>
                                {getProviderShortName(provider)}
                              </span>
                            )}
                            {messageModel?.name ?? "AI 助手"}
                          </span>
                          <span className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">{formatDate(message.createdAt)}</span>
                        </div>
                        <div className={`rounded-3xl rounded-tl-md border p-4 text-[#2f2e33] sm:p-6 ${providerSoftClassName} ${providerSurfaceClassName}`}>
                          <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/50 pb-3">
                            <div className="flex items-center gap-2">
                              {provider && (
                                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-bold shadow-sm ${getProviderIconClassName(provider)}`}>
                                  {getProviderShortName(provider)}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-bold tracking-tight text-[#2f2e33]">
                                  {messageModel?.name ?? "AI 助手"}
                                </p>
                                <p className="truncate text-[10px] font-medium text-stone-500">
                                  {provider ? formatReplyLength(messageModel?.defaultReplyLength ?? roomModel?.model.defaultReplyLength ?? 0) : "模型回复"}
                                </p>
                              </div>
                            </div>
                            {provider && (
                              <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${providerBadgeClassName}`}>
                                {getProviderShortName(provider)}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-[14px] sm:text-[15px] leading-[1.8] break-words">{message.content}</p>
                          {!provider && (
                              <div className="mt-2.5 flex items-center">
                                 <span className="inline-flex items-center justify-center rounded border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                                    未知模型
                                 </span>
                              </div>
                          )}
                        </div>
                     </article>
                  );
               })}

               {/* Pending User Msg */}
               {pendingUserContent && (
                  <article className="flex flex-col items-end gap-2 max-w-[85%] sm:max-w-2xl ml-auto animate-chat-in opacity-80">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">刚刚</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FF8DA1]/20 text-[10px] font-extrabold text-[#DC75A5] tracking-wider uppercase">用户</span>
                    </div>
                    <div className="bg-gradient-to-br from-[#DC75A5] to-[#FF8DA1] p-4 sm:p-5 rounded-3xl rounded-tr-md text-white shadow-xl shadow-[rgba(220,117,165,0.15)]">
                      <p className="whitespace-pre-wrap text-[14px] sm:text-[15px] leading-relaxed break-words">{pendingUserContent}</p>
                    </div>
                  </article>
               )}

               {/* Typing AI Msg */}
                {isSending && (
                  <article className="flex flex-col items-start gap-2 max-w-[90%] sm:max-w-3xl animate-chat-in">
                    <div className="flex items-center gap-2 px-1">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1.5 border ${
                          activeTimelineModel?.provider
                            ? getProviderBadgeClassName(activeTimelineModel.provider)
                            : "border-[#FF8DA1]/50 bg-[#FF8DA1]/10 text-[#DC75A5]"
                        }`}
                      >
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        {activeTimelineModel?.name ?? "AI 助手"}
                      </span>
                      <span className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">处理中...</span>
                    </div>
                    <div
                      className={`overflow-hidden rounded-3xl rounded-tl-md border p-6 backdrop-blur-md relative ${
                        activeTimelineModel?.provider
                          ? `${getProviderSoftClassName(activeTimelineModel.provider)} ${getProviderMessageSurfaceClassName(activeTimelineModel.provider)}`
                          : "border-[#FF8DA1]/50 bg-white/80 shadow-[0_8px_32px_rgba(220,117,165,0.08)]"
                      }`}
                    >
                      <div className="absolute top-0 left-0 h-1 w-full animate-pulse bg-gradient-to-r from-transparent via-[#DC75A5] to-transparent"></div>
                      <p className="text-[14px] sm:text-[15px] font-medium text-stone-500 animate-pulse italic">思考中，请稍候...</p>
                    </div>
                  </article>
                )}
            </div>
          </div>

          {/* Chat Input Area */}
          <div className="px-4 sm:px-8 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[rgba(249,245,252,0.92)] via-[rgba(249,245,252,0.82)] to-transparent z-20">
             <div className="ly-reading-wrap">
               <div className="ly-chat-input rounded-3xl p-2.5 flex flex-col gap-2">
                <div className="flex items-end gap-3 px-3 py-1">
                   <textarea
                     ref={textareaRef}
                     value={input}
                     onChange={(event) => {
                       setInput(event.target.value);
                       autoResizeTextarea();
                     }}
                     onKeyDown={handleComposerKeyDown}
                     placeholder="输入您的指令，回车发送..."
                     rows={1}
                     className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-3 resize-none outline-none font-medium placeholder:text-stone-400 min-h-[48px] max-h-[160px] scrollbar-thin overflow-y-auto text-[#2f2e33]"
                     disabled={isBusy && !isSending}
                   />
                   <button
                     type="button"
                     onClick={() => startTransition(() => void sendMessage({ preventDefault: () => {} } as React.FormEvent))}
                     disabled={!input.trim() || isBusy}
                     className="ly-primary-action flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed"
                   >
                     {isSending ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 14v1m8-8h-1M5 12H4m14.485-5.657l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707M17.657 17.657l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                     ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
                     )}
                   </button>
                </div>
               </div>
             </div>
              <p className="mt-4 text-center text-[10px] font-bold tracking-widest uppercase text-stone-400">Shift+Enter 换行 • 模型由人工智能驱动，可能存在不确切描述</p>
          </div>
        </section>

        {/* ─ Processing Chain Sidebar (Model Sequence) ─ */}
        {showSidePanel && (
           <>
             {/* Mobile backdrop */}
             <div className="fixed inset-0 z-30 bg-black/10 backdrop-blur-sm md:hidden" onClick={() => setShowSidePanel(false)} />
             
              <aside className="ly-glass absolute inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-white/45 shadow-2xl md:static md:z-10 md:shadow-none animate-slide-in">
                <div className="ly-soft-card m-4 mb-0 flex shrink-0 items-center justify-between p-4 sm:p-5">
                  <h2 className="font-extrabold text-[#2f2e33] flex items-center gap-2 text-[14px] tracking-widest uppercase">
                    <svg className="w-5 h-5 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    当前激活模型
                  </h2>
                  <button type="button" onClick={() => setShowSidePanel(false)} className="md:hidden p-1.5 bg-stone-100 rounded-full text-stone-500 hover:bg-stone-200">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
               </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin bg-transparent p-5">
                  {orderDirty && (
                    <div className="ly-soft-card mb-6 border-[#FF8DA1]/50 bg-white/60 px-4 py-3 shadow-[0_4px_12px_rgba(220,117,165,0.06)]">
                      <span className="text-[13px] font-extrabold text-[#DC75A5] block mb-1">等待保存新顺序</span>
                      <p className="text-[11px] text-[#DC75A5]/80 font-medium">保存后，新顺序将在下一轮对话中生效。</p>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void saveOrder())}
                        disabled={isBusy}
                        className="ly-primary-action mt-3 w-full px-3 py-2 text-[12px] font-bold disabled:opacity-50"
                      >
                        {activeAction === "saving-order" ? "保存中..." : "保存新的执行顺序"}
                      </button>
                    </div>
                  )}

                   <div className="space-y-4 relative ml-3 border-l-2 border-stone-200 pl-6 pb-2">
                     {orderedRoomModels.map((roomModel, index) => {
                       const isCurrent = isSending && index === pendingRound?.completedAssistantCount;
                       const isDone = isSending && index < (pendingRound?.completedAssistantCount ?? 0);
                       const provider = roomModel.model.provider;
                       const providerSoftClassName = getProviderSoftClassName(provider);
                       const providerSurfaceClassName = getProviderMessageSurfaceClassName(provider);
                       const providerAccentClassName = getProviderAccentClassName(provider);

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
                            previewMove(roomModel.modelId);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            clearDragState();
                          }}
                          onDragEnd={clearDragState}
                          className={`relative select-none ${
                            orderedRoomModels.length > 1 && !isBusy ? "cursor-grab active:cursor-grabbing" : ""
                          }`}
                        >
                          {/* Node circle on the vertical line */}
                          <div className={`absolute -left-[33px] top-[18px] w-3.5 h-3.5 rounded-full border-[3px] z-10 box-border border-[#f9f5fc] transition-colors duration-500 ${isCurrent ? `${providerAccentClassName} scale-125 shadow-[0_0_0_2px_rgba(255,255,255,0.55)]` : isDone ? providerAccentClassName : 'bg-stone-300'}`}></div>
                          
                          <div className={`p-4 rounded-2xl border transition-all duration-300 ${
                            dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId
                              ? "border-[#DC75A5] bg-white/50 scale-[1.02]"
                              : isCurrent 
                              ? `${providerSoftClassName} ${providerSurfaceClassName} ring-1 ring-white/40`
                              : `${providerSoftClassName} ${providerSurfaceClassName} hover:shadow-md`
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                               <h4 className="text-[12px] font-extrabold uppercase tracking-tighter text-[#2f2e33]">
                                  {index + 1}. {roomModel.model.name}
                               </h4>
                               <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isCurrent ? `${providerAccentClassName} text-white` : isDone ? 'bg-[#FF8DA1]/20 text-[#DC75A5]' : 'bg-stone-100 text-stone-500'}`}>
                                 {isCurrent ? '正在思考' : isDone ? '完成' : '待命'}
                               </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-stone-500 font-medium tracking-wide border-t border-stone-100 pt-2 mt-1">
                               <span className={`inline-flex w-4 h-4 items-center justify-center rounded-[4px] text-[7px] font-bold ${getProviderIconClassName(roomModel.model.provider)}`}>
                                 {getProviderShortName(roomModel.model.provider)}
                               </span>
                               <span>预设字数: {formatReplyLength(roomModel.model.defaultReplyLength)}</span>
                            </div>
                             {isCurrent && (
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="h-1 flex-1 rounded-full overflow-hidden relative bg-white/65">
                                     <div className={`absolute inset-y-0 left-0 w-1/2 rounded-full animate-[slideRight_1.5s_infinite_ease-in-out] ${providerAccentClassName}`}></div>
                                  </div>
                                </div>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </div>
             </aside>
           </>
        )}
      </div>
      </div>
    </main>
  );
}
