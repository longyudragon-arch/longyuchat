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
  getProviderChineseLabel,
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

type TimelineState = "done" | "active" | "pending" | "idle";
type OrderedRoomModel = RoomView["roomModels"][number];

function getProviderMessageChrome(provider: OrderedRoomModel["model"]["provider"]) {
  switch (provider) {
    case "OPENAI_COMPATIBLE":
      return {
        accentClassName: "bg-emerald-500",
        borderClassName: "border-emerald-200/80",
      };
    case "CLAUDE":
      return {
        accentClassName: "bg-amber-500",
        borderClassName: "border-amber-200/80",
      };
    case "GEMINI":
      return {
        accentClassName: "bg-sky-500",
        borderClassName: "border-sky-200/80",
      };
    case "GROK":
      return {
        accentClassName: "bg-violet-500",
        borderClassName: "border-violet-200/80",
      };
    case "DOUBAO":
      return {
        accentClassName: "bg-orange-500",
        borderClassName: "border-orange-200/80",
      };
    case "DEEPSEEK":
      return {
        accentClassName: "bg-cyan-500",
        borderClassName: "border-cyan-200/80",
      };
    case "MODELSCOPE":
      return {
        accentClassName: "bg-fuchsia-500",
        borderClassName: "border-fuchsia-200/80",
      };
    case "HUNYUAN":
      return {
        accentClassName: "bg-rose-500",
        borderClassName: "border-rose-200/80",
      };
    case "QWEN":
      return {
        accentClassName: "bg-indigo-500",
        borderClassName: "border-indigo-200/80",
      };
    default:
      return {
        accentClassName: "bg-zinc-400",
        borderClassName: "border-[var(--border)]",
      };
  }
}

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback | null }) {
  if (!feedback) return null;

  const toneClass =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{feedback.title}</p>
      <p className="mt-2 text-sm leading-6">{feedback.description}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">建议：{feedback.suggestion}</p>
    </div>
  );
}

function Chip({ text, className }: { text: string; className: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{text}</span>;
}

function TimelineStepCard({
  roomModel,
  index,
  state,
  isLast = false,
  compact = false,
}: {
  roomModel: OrderedRoomModel;
  index: number;
  state: TimelineState;
  isLast?: boolean;
  compact?: boolean;
}) {
  const stateChipClass =
    state === "done"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : state === "active"
        ? "border-sky-200 bg-sky-100 text-sky-700 animate-pulse"
        : state === "pending"
          ? "border-zinc-200 bg-white/80 text-zinc-600"
          : "border-[var(--border)] bg-white/70 text-[var(--muted)]";

  const panelClass =
    state === "done"
      ? "border-emerald-200 bg-emerald-50/60"
      : state === "active"
        ? "border-sky-300 bg-white shadow-[0_12px_24px_rgba(14,165,233,0.12)] ring-1 ring-sky-100"
        : state === "pending"
          ? "border-zinc-200 bg-white/90"
          : "border-[var(--border)] bg-white/75";

  const stateText = state === "done" ? "已完成" : state === "active" ? "思考中" : state === "pending" ? "等待中" : "待命";

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-[39px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-[var(--border)] to-transparent" />
      )}
      <div className={`relative z-10 rounded-[1.8rem] border px-4 py-4 transition-all duration-500 ${panelClass}`}>
        <div className="flex items-start gap-4">
          <div className="relative">
            <span
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] shadow-sm ${getProviderIconClassName(
                roomModel.model.provider,
              )}`}
            >
              {getProviderShortName(roomModel.model.provider)}
            </span>
            {state === "active" && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-sky-500" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[rgb(248,246,242)] px-2 text-[10px] font-medium text-[var(--muted)]">
                {index + 1}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getProviderBadgeClassName(roomModel.model.provider)}`}
              >
                {getProviderChineseLabel(roomModel.model.provider)}
              </span>
              <Chip text={stateText} className={`py-0.5 text-[10px] ${stateChipClass}`} />
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-relaxed tracking-tight">{roomModel.model.name}</p>
            {!compact ? (
              <p className="mt-1 text-xs text-[var(--muted)] opacity-80">默认回复上限：{formatReplyLength(roomModel.model.defaultReplyLength)}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
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
    setNotice(`本轮协作正在推进，已完成 ${completedAssistantCount}/${expectedAssistantCount} 个模型回复。`);
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
      setNotice("房间已经加载完成。");
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

  const pendingTimeline = useMemo<Array<{ roomModel: OrderedRoomModel; state: TimelineState }>>(() => {
    if (!pendingRound || !isSending) return [];
    const total = Math.min(pendingRound.expectedAssistantCount, orderedRoomModels.length);
    return orderedRoomModels.slice(0, total).map((roomModel, index) => ({
      roomModel,
      state:
        index < pendingRound.completedAssistantCount
          ? "done"
          : index === pendingRound.completedAssistantCount
            ? "active"
            : "pending",
    }));
  }, [isSending, orderedRoomModels, pendingRound]);

  const activeTimelineModel = pendingTimeline.find((item) => item.state === "active")?.roomModel.model.name ?? null;
  const timelineDisplayItems = useMemo(
    () =>
      pendingTimeline.length > 0
        ? pendingTimeline
        : orderedRoomModels.map((roomModel) => ({
            roomModel,
            state: "idle" as TimelineState,
          })),
    [orderedRoomModels, pendingTimeline],
  );
  const currentFocusModel =
    pendingTimeline.find((item) => item.state === "active")?.roomModel ??
    pendingTimeline.find((item) => item.state === "pending")?.roomModel ??
    null;
  const progressLabel = pendingRound
    ? `${pendingRound.completedAssistantCount}/${pendingRound.expectedAssistantCount}`
    : `${room?.roomModels.length ?? 0} 个模型`;
  const timelineHeadline = isSending
    ? activeTimelineModel
      ? `当前轮到 ${activeTimelineModel}`
      : "正在同步这一轮的最终结果"
    : "等待你发起下一轮";
  const timelineDescription = isSending
    ? `这一轮已经完成 ${pendingRound?.completedAssistantCount ?? 0} 个模型回复。`
    : "发送消息后，模型会按照右侧顺序依次出现。";

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
      setNotice("顺序已经保存。");
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
      setNotice(`房间已重命名为「${data.room.title}」。`);
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
        description: "你刚刚调整了模型顺序，但服务端还没有保存。",
        suggestion: "请先点击右侧“保存排序”，再发送下一条消息。",
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
    setNotice(`本轮协作开始，准备依次等待 ${expectedAssistantCount} 个模型回复。`);

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
        setNotice("这一轮只完成了部分回复。");
      } else {
        setNotice("消息已发送，本轮顺序回复已经完成。");
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
    return (
      <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
        <div className="ly-glass h-56 animate-pulse rounded-[2.6rem]" />
        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="ly-glass h-[620px] animate-pulse rounded-[2.6rem]" />
          <div className="ly-glass h-[500px] animate-pulse rounded-[2.6rem]" />
        </div>
      </main>
    );
  }

  return (
    <main className="ly-shell flex flex-col gap-5 px-4 py-4 sm:gap-6 sm:px-5 sm:py-8">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:gap-6">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.2rem] px-6 py-7 sm:px-8 sm:py-9 xl:rounded-[2.8rem]">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.24em] text-white/80 uppercase">
              正在访问
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl xl:text-5xl">
              {room?.title ?? "加载中..."}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-base">
              多模型顺序协作工作区。系统会根据你配置的顺序，自动流转上下文并依次获取回复。
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80">
                {room ? toRoomLabel(room.type) : "房间"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80">
                {room?.roomModels.length ?? 0} 模型成员
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rooms" className="inline-flex items-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-95">
                返回房间列表
              </Link>
              <button type="button" onClick={() => startTransition(() => void renameRoom())} disabled={!room || isBusy} className="inline-flex items-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-95">
                重命名
              </button>
              <Link href={`/rooms/${roomId}/edit`} className="inline-flex items-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-95">
                设置房间
              </Link>
              <button type="button" onClick={() => startTransition(() => void deleteRoom())} disabled={!room || isBusy} className="inline-flex items-center rounded-2xl bg-red-500/10 px-5 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-40">
                删除
              </button>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-[var(--accent)] opacity-10 blur-[80px]" />
        </div>

        <div className="ly-glass flex flex-col rounded-[2.2rem] p-5 sm:p-7 xl:rounded-[2.8rem]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--navy)]" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--navy)] uppercase">
                协作链路
              </span>
            </div>
            <Chip text={progressLabel} className="border-[var(--border)] bg-white/60 font-bold text-[var(--muted)]" />
          </div>

          <div className="mt-5 flex-1 space-y-4">
            <div className="rounded-[2.2rem] bg-[linear-gradient(135deg,#1f2f44,#1a2a3e_50%,#162231)] px-6 py-6 text-white shadow-[0_20px_48px_rgba(15,23,34,0.2)] ring-1 ring-white/10">
              <div className="flex items-start gap-5">
                <div className="relative">
                  <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xs font-bold tracking-[0.2em] shadow-lg ${currentFocusModel ? getProviderIconClassName(currentFocusModel.model.provider) : "bg-white/10 text-white/50"}`}>
                    {currentFocusModel ? getProviderShortName(currentFocusModel.model.provider) : "待命"}
                  </span>
                  {isSending && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-sky-500 shadow-sm" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold tracking-tight">
                    {currentFocusModel ? timelineHeadline : "等待消息"}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {currentFocusModel ? `${timelineDescription}${notice ? ` ${notice}` : ""}` : "配置已就绪。"}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1 scrollbar-none">
              {timelineDisplayItems.map(({ roomModel, state }, index) => (
                <TimelineStepCard
                  key={roomModel.id}
                  roomModel={roomModel}
                  index={index}
                  state={state}
                  isLast={index === timelineDisplayItems.length - 1}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <FeedbackPanel feedback={feedback} />

      <section className="sticky top-[4.5rem] z-30 -mx-1 xl:hidden">
        <div className="bg-[#f0e7da]/80 p-1 backdrop-blur-md">
          <div className="ly-glass grid grid-cols-2 gap-1.5 rounded-2xl p-1.5 shadow-lg">
            <button type="button" onClick={() => setMobilePanel("chat")} className={`rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${mobilePanel === "chat" ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20" : "bg-white/50 text-[var(--muted)]"}`}>
              消息流
            </button>
            <button type="button" onClick={() => setMobilePanel("order")} className={`rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${mobilePanel === "order" ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20" : "bg-white/50 text-[var(--muted)]"}`}>
              顺序控制
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr] xl:gap-6">
        <div className={`${mobilePanel === "chat" ? "block" : "hidden"} xl:block`}>
          <div className="ly-glass rounded-[2.2rem] p-4 sm:rounded-[2.6rem] sm:p-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">聊天流</p>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold">顺序协作消息流</h2>
                <span className="rounded-full border border-[var(--border)] bg-white/78 px-3 py-1 text-xs text-[var(--muted)]">
                  {room ? `${toRoomLabel(room.type)} · 最后更新 ${formatDate(room.updatedAt)}` : "正在读取房间"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex min-h-[66svh] flex-col rounded-[1.8rem] border border-[var(--border)] bg-white/50 sm:min-h-[620px] sm:rounded-[2rem]">
              <div ref={messageListRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
                <div className="sticky top-0 z-10 -mx-4 mb-6 rounded-[1.6rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98),rgba(255,255,255,0.94))] px-5 py-4 shadow-[0_12px_32px_rgba(17,17,17,0.06)] backdrop-blur-xl sm:-mx-8 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                        <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">实时协作焦点</p>
                      </div>
                      <h3 className="mt-1.5 truncate text-lg font-bold tracking-tight">
                        {currentFocusModel ? timelineHeadline : "待命状态"}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] line-clamp-1">
                        {currentFocusModel ? timelineDescription : "准备就绪，随时可以开始下一轮顺序协作。"}
                      </p>
                    </div>
                    <Chip text={progressLabel} className="shrink-0 border-[var(--border)] bg-white/80 font-bold text-[var(--muted)]" />
                  </div>
                </div>

                {messages.map((message) => {
                  if (message.role === "USER") {
                    const status = getUserMessageRoundStatus({
                      message,
                      messages,
                      expectedAssistantCount: room?.roomModels.length ?? 1,
                      pendingRoundUserSequence: pendingRound?.userSequence,
                      sendInProgress: isSending,
                    });

                    const statusChipClass =
                      status === "completed"
                        ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
                        : status === "partial"
                          ? "border-amber-200 bg-amber-50/80 text-amber-700"
                          : status === "in-progress"
                            ? "border-sky-200 bg-sky-50/80 text-sky-700"
                            : status === "awaiting"
                              ? "border-zinc-200 bg-white/80 text-zinc-600"
                              : "border-emerald-200 bg-emerald-50/80 text-emerald-700";

                    const statusText =
                      status === "completed"
                        ? "已完成"
                        : status === "partial"
                          ? "部分成功"
                          : status === "in-progress"
                            ? "执行中"
                            : status === "awaiting"
                              ? "等待排队"
                              : "已送达";

                    return (
                      <article key={message.id} className="ml-auto max-w-[92%] sm:max-w-[82%]">
                        <div className="group relative rounded-[2.2rem] rounded-tr-[0.6rem] bg-[linear-gradient(135deg,#c35a2f,#b34a1f_40%,#8f3416)] px-5 py-4 text-white shadow-[0_12px_32px_rgba(143,52,22,0.18)] transition-all hover:shadow-[0_16px_40px_rgba(143,52,22,0.24)] sm:px-6 sm:py-5">
                          <div className="mb-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                              <span className="inline-flex h-5 items-center rounded-full bg-white/10 px-2.5 text-white/90">
                                {toRoleLabel(message.role)}
                              </span>
                              <span>{formatDate(message.createdAt)}</span>
                            </div>
                            <Chip text={statusText} className={`py-0.5 text-[10px] font-bold ${statusChipClass}`} />
                          </div>
                          <p className="whitespace-pre-wrap text-[15px] font-medium leading-[1.8] sm:text-[16px]">{message.content}</p>
                        </div>
                      </article>
                    );
                  }

                  const roomModel = room?.roomModels.find((candidate) => candidate.modelId === message.modelId) ?? null;
                  const messageModel = roomModel?.model ?? message.model;
                  const provider = messageModel?.provider;
                  const chrome = provider ? getProviderMessageChrome(provider) : null;

                  return (
                    <article key={message.id} className="max-w-[92%] sm:max-w-[82%]">
                      <div
                        className={`overflow-hidden rounded-[2.2rem] rounded-tl-[0.6rem] border px-5 py-4 shadow-[0_10px_30px_rgba(17,17,17,0.04)] transition-all hover:shadow-[0_14px_36px_rgba(17,17,17,0.06)] sm:px-6 sm:py-5 ${provider ? `${getProviderSoftClassName(provider)} ${chrome?.borderClassName}` : "border-[var(--border)] bg-white/90"}`}
                      >
                        {chrome ? <div className={`-mx-6 -mt-5 mb-4 h-1.5 sm:-mx-7 sm:-mt-6 ${chrome.accentClassName}`} /> : null}
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          {provider ? (
                            <>
                              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-[1.2rem] text-[10px] font-bold tracking-[0.2em] shadow-sm ${getProviderIconClassName(provider)}`}>{getProviderShortName(provider)}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[15px] font-bold tracking-tight">{messageModel?.name ?? "AI助手"}</span>
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${getProviderBadgeClassName(provider)}`}>{getProviderChineseLabel(provider)}</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--muted)] opacity-70">
                                  <span>{formatDate(message.createdAt)}</span>
                                  <span>·</span>
                                  <span>{formatReplyLength(messageModel?.defaultReplyLength ?? 300)}</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <span className="text-[15px] font-bold">AI 助手</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-[15px] leading-[1.8] text-[var(--foreground)] opacity-95 sm:text-[16px]">{message.content}</p>
                      </div>
                    </article>
                  );
                })}

                {pendingUserContent ? (
                  <article className="ml-auto max-w-[92%] sm:max-w-[82%]">
                    <div className="rounded-[2.2rem] rounded-tr-[0.6rem] border border-[var(--accent)] bg-[rgba(195,90,47,0.08)] px-5 py-4 shadow-sm sm:px-6 sm:py-5">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] opacity-60">
                          <span className="inline-flex h-5 items-center rounded-full bg-black/5 px-2.5">用户</span>
                          <span>正在发送...</span>
                        </div>
                        <Chip text="发送中" className="border-zinc-200 bg-white/80 font-bold text-zinc-500" />
                      </div>
                      <p className="whitespace-pre-wrap text-[15px] font-medium leading-[1.8] opacity-60 sm:text-[16px]">{pendingUserContent}</p>
                    </div>
                  </article>
                ) : null}

                {pendingTimeline.length > 0 ? (
                  <article className="max-w-[92%] sm:max-w-[82%]">
                    <div className="rounded-[2.4rem] border border-dashed border-sky-300 bg-sky-50/60 px-5 py-6 shadow-[0_20px_40px_rgba(14,165,233,0.08)] sm:px-8">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                            <div className="text-[10px] font-bold tracking-[0.2em] text-sky-700 uppercase">轮次时间线</div>
                          </div>
                          <p className="mt-2 text-[15px] font-bold leading-relaxed text-sky-900">{activeTimelineModel ? `当前轮到 ${activeTimelineModel} 回复` : "正在同步这一轮的最终结果"}</p>
                        </div>
                        <Chip text={`${pendingRound?.completedAssistantCount ?? 0}/${pendingRound?.expectedAssistantCount ?? room?.roomModels.length ?? 0}`} className="border-sky-200 bg-white/90 font-bold text-sky-700" />
                      </div>
                      <div className="mt-6 space-y-4">
                        {pendingTimeline.map(({ roomModel, state }, index) => (
                          <TimelineStepCard
                            key={roomModel.id}
                            roomModel={roomModel}
                            index={index}
                            state={state}
                            isLast={index === pendingTimeline.length - 1}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>

              <div className="sticky bottom-0 z-20 border-t border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,248,242,0.94),rgba(255,255,255,0.98))] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:bg-transparent sm:px-6 sm:pb-4">
                <textarea value={messageInput} onChange={(event) => setMessageInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="输入消息后回车发送，按 Shift + 回车换行..." rows={4} className="w-full resize-none rounded-[1.6rem] border border-[var(--border)] bg-white/92 px-4 py-4 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(195,90,47,0.12)] sm:rounded-[1.8rem]" />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-xs ${orderDirty ? "text-amber-700" : "text-[var(--muted)]"}`}>{orderDirty ? "当前有未保存的顺序调整，请先保存排序。" : "系统会按已保存顺序依次回复，并遵守每个模型自己的字数限制。"}</p>
                  <button type="button" onClick={() => startTransition(() => void sendMessage())} disabled={!messageInput.trim() || isBusy} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300">{isSending ? "等待回复中..." : "发送消息"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className={`${mobilePanel === "order" ? "block" : "hidden"} xl:block`}>
          <div className="ly-glass rounded-[2.2rem] p-5 sm:rounded-[2.6rem] sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">顺序控制</p>
            <h2 className="mt-3 text-2xl font-semibold">当前模型顺序</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">拖拽卡片就会实时换位。下一轮会严格按照保存后的顺序执行。</p>
            <div className={`mt-4 rounded-[1.6rem] border px-4 py-3 text-sm ${orderDirty ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[var(--border)] bg-white/80 text-[var(--muted)]"}`}>{orderDirty ? "当前顺序只在本地生效，服务端还没有保存。" : "当前顺序已经保存。"}</div>
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
                  className={`rounded-[1.6rem] border px-4 py-4 transition-all sm:rounded-[1.8rem] ${dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId ? "border-[var(--accent)] bg-[rgba(195,90,47,0.10)]" : "border-[var(--border)] bg-white/82"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(roomModel.model.provider)}`}>{getProviderShortName(roomModel.model.provider)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--border)] bg-[rgb(248,246,242)] px-3 py-1 text-xs text-[var(--muted)]">{index + 1}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(roomModel.model.provider)}`}>{getProviderChineseLabel(roomModel.model.provider)}</span>
                      </div>
                      <p className="mt-2 font-medium">{roomModel.model.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">默认回复上限：{formatReplyLength(roomModel.model.defaultReplyLength)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => startTransition(() => void saveOrder())} disabled={!orderDirty || isBusy} className="mt-6 w-full rounded-[1.5rem] bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300">{activeAction === "saving-order" ? "正在保存..." : "保存排序"}</button>
          </div>
        </aside>
      </section>
    </main>
  );
}
