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

function FeedbackPanel({ feedback }: { feedback: ClientErrorFeedback | null }) {
  if (!feedback) return null;
  const toneClass =
    feedback.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900";
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
    setNotice(`本轮协作正在推进：${completedAssistantCount}/${expectedAssistantCount}`);
  }

  async function watchSequentialReplies(baselineSequence: number, expectedAssistantCount: number, requestPromise: Promise<unknown>) {
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
      if (!settled) await new Promise((resolve) => setTimeout(resolve, 900));
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

  const pendingTimeline = useMemo(() => {
    if (!pendingRound || !isSending) return [];
    const total = Math.min(pendingRound.expectedAssistantCount, orderedRoomModels.length);
    return orderedRoomModels.slice(0, total).map((roomModel, index) => ({
      roomModel,
      state:
        index < pendingRound.completedAssistantCount ? "done" : index === pendingRound.completedAssistantCount ? "active" : "pending",
    }));
  }, [isSending, orderedRoomModels, pendingRound]);

  const activeTimelineModel = pendingTimeline.find((item) => item.state === "active")?.roomModel.model.name ?? null;

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
      setNotice("排序已经保存。");
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
    setNotice(`本轮协作正在推进：0/${expectedAssistantCount}`);

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
        setNotice("本轮回复部分完成。");
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
      if (!isBusy) startTransition(() => void sendMessage());
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
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="ly-dark-panel ly-grid-lines overflow-hidden rounded-[2.8rem] px-6 py-7 sm:px-8 sm:py-9">
          <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">CONVERSATION ROOM</span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">{room?.title ?? "正在加载房间..."}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">这里不只是消息列表，而是一套清楚展示“谁先说、谁正在思考、谁已经完成”的多模型协作工作区。</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-white/78">{room ? toRoomLabel(room.type) : "房间"}</span>
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-white/78">{room?.roomModels.length ?? 0} 个模型参与</span>
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-white/78">累计 {room?.messageCount ?? 0} 条消息</span>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Link href="/rooms" className="rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-4 text-sm text-white/82 transition hover:bg-white/10">返回房间列表</Link>
            <Link href={`/rooms/${roomId}/edit`} className="rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-4 text-sm text-white/82 transition hover:bg-white/10">编辑当前房间</Link>
            <Link href="/rooms/new" className="rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-4 text-sm text-white/82 transition hover:bg-white/10">新建另一个房间</Link>
          </div>
        </div>

        <div className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--navy-soft)] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--navy)]">LIVE ORDER</span>
            <span className="text-sm text-[var(--muted)]">{notice || "可以直接开始聊天，也可以先调整模型顺序。"}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold">当前轮次与模型链路</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">用户消息发出后，模型会严格按当前顺序逐个回复。你可以在等待时直接看到本轮已经完成到哪一步。</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {orderedRoomModels.map((roomModel, index) => {
              const timelineItem = pendingTimeline.find((item) => item.roomModel.id === roomModel.id);
              const state = timelineItem?.state ?? "idle";
              return (
                <div key={roomModel.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-3 rounded-full border px-3 py-2 ${state === "done" ? "border-emerald-200 bg-emerald-50" : state === "active" ? "border-sky-200 bg-sky-50 shadow-[0_0_0_6px_rgba(14,165,233,0.08)]" : "border-[var(--border)] bg-white/86"}`}>
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] ${getProviderIconClassName(roomModel.model.provider)}`}>{getProviderShortName(roomModel.model.provider)}</span>
                    <div>
                      <p className="text-sm font-medium leading-5">{roomModel.model.name}</p>
                      <p className="text-[10px] text-[var(--muted)]">{state === "done" ? "已完成" : state === "active" ? "思考中" : "等待中"}</p>
                    </div>
                  </div>
                  {index < orderedRoomModels.length - 1 ? <span className="text-[var(--accent)]">→</span> : null}
                </div>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => startTransition(() => void renameRoom())} disabled={!room || isBusy} className="rounded-[1.4rem] border border-[var(--border)] bg-white/84 px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)] disabled:opacity-60">重命名房间</button>
            <button type="button" onClick={() => startTransition(() => void deleteRoom())} disabled={!room || isBusy} className="rounded-[1.4rem] border border-red-200 bg-white/84 px-4 py-3 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60">删除房间</button>
          </div>
        </div>
      </section>

      <FeedbackPanel feedback={feedback} />

      <section className="xl:hidden">
        <div className="ly-glass grid grid-cols-2 gap-2 rounded-[1.6rem] p-2">
          <button type="button" onClick={() => setMobilePanel("chat")} className={`rounded-[1.2rem] px-4 py-3 text-sm font-medium ${mobilePanel === "chat" ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted)]"}`}>聊天</button>
          <button type="button" onClick={() => setMobilePanel("order")} className={`rounded-[1.2rem] px-4 py-3 text-sm font-medium ${mobilePanel === "order" ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted)]"}`}>顺序</button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <div className={`${mobilePanel === "chat" ? "block" : "hidden"} xl:block`}>
          <div className="ly-glass rounded-[2.6rem] p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">CHAT STREAM</p>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold">顺序协作消息流</h2>
                <span className="rounded-full border border-[var(--border)] bg-white/78 px-3 py-1 text-xs text-[var(--muted)]">{room ? `${toRoomLabel(room.type)} · 最后更新 ${formatDate(room.updatedAt)}` : "正在读取房间"}</span>
              </div>
            </div>

            <div className="mt-5 flex min-h-[460px] flex-col rounded-[2rem] border border-[var(--border)] bg-white/50 sm:min-h-[620px]">
              <div ref={messageListRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
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
                      status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : status === "partial" ? "border-amber-200 bg-amber-50 text-amber-700"
                      : status === "in-progress" ? "border-sky-200 bg-sky-50 text-sky-700"
                      : status === "awaiting" ? "border-zinc-200 bg-white/80 text-zinc-600"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700";
                    const statusText =
                      status === "completed" ? "双对勾 已完成"
                      : status === "partial" ? "部分完成"
                      : status === "in-progress" ? "进行中"
                      : status === "awaiting" ? "等待中"
                      : "单对勾 已送达";
                    return (
                      <article key={message.id} className="ml-auto max-w-[96%] sm:max-w-[86%]">
                        <div className="rounded-[2rem] rounded-tr-[0.6rem] bg-[linear-gradient(135deg,#c35a2f,#8f3416)] px-5 py-4 text-white shadow-[0_18px_36px_rgba(143,52,22,0.22)]">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/70"><span>{toRoleLabel(message.role)}</span><span>{formatDate(message.createdAt)}</span></div>
                            <Chip text={statusText} className={statusChipClass} />
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                        </div>
                      </article>
                    );
                  }

                  const roomModel = room?.roomModels.find((candidate) => candidate.modelId === message.modelId) ?? null;
                  const messageModel = roomModel?.model ?? message.model;
                  const provider = messageModel?.provider;
                  return (
                    <article key={message.id} className="max-w-[96%] sm:max-w-[86%]">
                      <div className={`rounded-[2rem] rounded-tl-[0.6rem] px-5 py-4 shadow-[0_16px_34px_rgba(17,17,17,0.06)] ${provider ? getProviderSoftClassName(provider) : "bg-white/78"}`}>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {provider ? (
                            <>
                              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] ${getProviderIconClassName(provider)}`}>{getProviderShortName(provider)}</span>
                              <span className="text-sm font-medium">{messageModel?.name ?? "AI"}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(provider)}`}>{getProviderOptionLabel(provider)}</span>
                              <span className="text-xs text-[var(--muted)]">{formatReplyLength(messageModel?.defaultReplyLength ?? 300)}</span>
                            </>
                          ) : <span className="text-sm font-medium">AI</span>}
                          <span className="text-xs text-[var(--muted)]">{formatDate(message.createdAt)}</span>
                        </div>
                        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{toRoleLabel(message.role)}</div>
                        <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                      </div>
                    </article>
                  );
                })}

                {pendingUserContent ? (
                  <article className="ml-auto max-w-[96%] sm:max-w-[86%]">
                    <div className="rounded-[2rem] rounded-tr-[0.6rem] border border-[var(--accent)] bg-[rgba(195,90,47,0.10)] px-5 py-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]"><span>用户</span><span>正在发送</span></div>
                        <Chip text="发送中" className="border-zinc-200 bg-white/80 text-zinc-500" />
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7">{pendingUserContent}</p>
                    </div>
                  </article>
                ) : null}

                {pendingTimeline.length > 0 ? (
                  <article className="max-w-[96%] sm:max-w-[86%]">
                    <div className="rounded-[2rem] border border-dashed border-sky-200 bg-sky-50/80 px-5 py-4 shadow-[0_14px_30px_rgba(14,165,233,0.08)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-sky-700">ROUND TIMELINE</div>
                          <p className="mt-2 text-sm leading-6 text-sky-900">{activeTimelineModel ? `当前轮到 ${activeTimelineModel} 回复。` : "正在同步本轮最终结果。"}</p>
                        </div>
                        <Chip text={`${pendingRound?.completedAssistantCount ?? 0}/${pendingRound?.expectedAssistantCount ?? room?.roomModels.length ?? 0}`} className="border-sky-200 bg-white/90 text-sky-700" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {pendingTimeline.map(({ roomModel, state }, index) => (
                          <div key={roomModel.id} className={`rounded-[1.4rem] border px-4 py-3 ${state === "done" ? "border-emerald-200 bg-emerald-50/80" : state === "active" ? "border-sky-200 bg-white shadow-[0_0_0_6px_rgba(14,165,233,0.08)]" : "border-zinc-200 bg-white/78"}`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl text-[10px] font-semibold tracking-[0.2em] ${getProviderIconClassName(roomModel.model.provider)}`}>{getProviderShortName(roomModel.model.provider)}</span>
                              <span className="rounded-full border border-[var(--border)] bg-[rgb(248,246,242)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{index + 1}</span>
                              <span className="text-sm font-medium">{roomModel.model.name}</span>
                              <Chip text={state === "done" ? "已完成" : state === "active" ? "思考中" : "等待中"} className={state === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : state === "active" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-zinc-200 bg-white/80 text-zinc-600"} />
                            </div>
                            <p className="mt-2 text-sm text-[var(--muted)]">默认回复上限：{formatReplyLength(roomModel.model.defaultReplyLength)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>

              <div className="border-t border-[var(--border)] px-4 py-4 sm:px-6">
                <textarea value={messageInput} onChange={(event) => setMessageInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="输入消息并发送，Enter 发送，Shift+Enter 换行..." rows={4} className="w-full resize-none rounded-[1.8rem] border border-[var(--border)] bg-white/92 px-4 py-4 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(195,90,47,0.12)]" />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-xs ${orderDirty ? "text-amber-700" : "text-[var(--muted)]"}`}>{orderDirty ? "当前有未保存的顺序调整，请先保存排序。" : "系统会按已保存顺序依次回复，并遵守每个模型自己的字数限制。"}</p>
                  <button type="button" onClick={() => startTransition(() => void sendMessage())} disabled={!messageInput.trim() || isBusy} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300">{isSending ? "等待回复中..." : "发送消息"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className={`${mobilePanel === "order" ? "block" : "hidden"} xl:block`}>
          <div className="ly-glass rounded-[2.6rem] p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">ORDER CONTROL</p>
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
                  onDragOver={(event) => { event.preventDefault(); previewMove(roomModel.modelId); }}
                  onDrop={(event) => { event.preventDefault(); clearDragState(); }}
                  onDragEnd={clearDragState}
                  className={`rounded-[1.8rem] border px-4 py-4 transition-all ${dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId ? "border-[var(--accent)] bg-[rgba(195,90,47,0.10)]" : "border-[var(--border)] bg-white/82"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${getProviderIconClassName(roomModel.model.provider)}`}>{getProviderShortName(roomModel.model.provider)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--border)] bg-[rgb(248,246,242)] px-3 py-1 text-xs text-[var(--muted)]">{index + 1}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getProviderBadgeClassName(roomModel.model.provider)}`}>{getProviderOptionLabel(roomModel.model.provider)}</span>
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
