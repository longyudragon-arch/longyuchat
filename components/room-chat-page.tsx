"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, type KeyboardEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  describeClientError,
  describeInterruptedSendRecovery,
  describePartialSendResult,
  describeSkippedModelsResult,
  fetchJson,
  findNextUserMessageAfterSequence,
  formatDate,
  formatReplyDurationMs,
  formatReplyLength,
  getModelOperationalInsight,
  getProviderBadgeClassName,
  getProviderSoftClassName,
  getProviderShortName,
  listAssistantRepliesForUserMessage,
  listAssistantReplyModelIdsForUserMessage,
  reorderIds,
  sendRoomMessageRequest,
  toRoomLabel,
  type ClientErrorFeedback,
} from "@/lib/client/chat-lab-client";
import { getModelAvatarPalette, resolveModelAvatar } from "@/lib/model-avatar";
import type {
  ConversationRoundEventView,
  MessageView,
  ProviderType,
  RoomRoundEventStreamView,
  RoomStreamSnapshotView,
  RoomView,
  SendRoomMessageResult,
} from "@/types/app";

interface RoomChatPageProps {
  roomId: string;
}

type RoomAction = "loading" | "sending" | "saving-order" | "renaming-room" | "deleting-room" | null;

type PendingRoundState = {
  baselineSequence: number;
  userSequence: number | null;
  completedAssistantCount: number;
  expectedAssistantCount: number;
  repliedModelIds: string[];
};

type CurrentConversationRound = NonNullable<RoomView["currentRound"]>;
type CurrentConversationRoundStep = CurrentConversationRound["steps"][number];

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

function formatFailureKindLabel(kind: string) {
  switch (kind) {
    case "authentication":
      return "鉴权失败";
    case "quota":
      return "额度不足";
    case "network":
      return "网络或超时";
    case "not_found":
      return "模型或接口不存在";
    case "empty_response":
      return "空回复";
    case "reasoning_only":
      return "仅推理无正文";
    default:
      return "调用失败";
  }
}

function isRoomModelCoolingDown(roomModel: RoomView["roomModels"][number], now = new Date()) {
  if (roomModel.executionState !== "COOLDOWN" || !roomModel.cooldownUntil) {
    return false;
  }

  return new Date(roomModel.cooldownUntil).getTime() > now.getTime();
}

function isRoomModelHalfOpen(roomModel: RoomView["roomModels"][number]) {
  return roomModel.executionState === "HALF_OPEN";
}

function isRoundStepCompleted(step: CurrentConversationRoundStep) {
  return step.status === "REPLIED" || step.status === "FAILED";
}

/* ─── Small sub-components ─── */

function FeedbackPanel({ feedback, onDismiss }: { feedback: ClientErrorFeedback | null; onDismiss: () => void }) {
  if (!feedback) return null;

  const toneClass =
    feedback.tone === "warning"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : "border-red-200 bg-red-50/90 text-red-900";

  return (
    <div
      data-testid="room-feedback-panel"
      data-feedback-tone={feedback.tone}
      className={`ly-surface-card animate-chat-in mx-auto max-w-3xl px-4 py-2.5 ${toneClass}`}
    >
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

function RoomModelAlert({
  modelName,
  shortLabel,
  title,
  description,
  suggestion,
  tone,
}: {
  modelName: string;
  shortLabel: string;
  title: string;
  description: string;
  suggestion: string;
  tone: "warning" | "error";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200/70 bg-amber-50/85 text-amber-900"
      : "border-red-200/70 bg-red-50/85 text-red-900";
  const badgeClass =
    tone === "warning"
      ? "border-amber-300/70 bg-amber-100/80 text-amber-800"
      : "border-red-300/70 bg-red-100/80 text-red-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${badgeClass}`}>{shortLabel}</span>
        <p className="text-[12px] font-bold">{modelName}：{title}</p>
      </div>
      <p className="mt-1 text-[12px] leading-6 opacity-90">{description}</p>
      <p className="mt-1 text-[11px] leading-5 opacity-75">建议：{suggestion}</p>
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
  const roomStateRef = useRef<RoomView | null>(null);
  const messagesRef = useRef<MessageView[]>([]);
  const pendingRoundRef = useRef<PendingRoundState | null>(null);
  const roomEventStreamConnectedRef = useRef(false);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [pendingUserContent, setPendingUserContent] = useState("");
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [activeAction, setActiveAction] = useState<RoomAction>("loading");
  const [pendingRound, setPendingRound] = useState<PendingRoundState | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<SendRoomMessageResult | null>(null);
  const [draftModelIds, setDraftModelIds] = useState<string[]>([]);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasRoomEventStream, setHasRoomEventStream] = useState(false);

  const isBusy = activeAction !== null;
  const isSending = activeAction === "sending";

  /* ─── Data loading ─── */

  function applyRoomState(nextRoom: RoomView) {
    roomStateRef.current = nextRoom;
    setRoom(nextRoom);
    setDraftModelIds(nextRoom.roomModels.map((item) => item.modelId));
  }

  function applyMessagesState(nextMessages: MessageView[]) {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }

  function applyPendingRoundState(nextPendingRound: PendingRoundState | null) {
    pendingRoundRef.current = nextPendingRound;
    setPendingRound(nextPendingRound);
  }

  async function fetchRoomState() {
    const data = await fetchJson<{ room: RoomView }>(`/api/rooms/${roomId}`);
    return data.room;
  }

  async function loadRoom() {
    const nextRoom = await fetchRoomState();
    applyRoomState(nextRoom);
    return nextRoom;
  }

  async function fetchMessagesState() {
    const data = await fetchJson<{ messages: MessageView[] }>(`/api/rooms/${roomId}/messages`);
    return data.messages;
  }

  async function loadMessages() {
    const nextMessages = await fetchMessagesState();
    applyMessagesState(nextMessages);
    return nextMessages;
  }

  function syncPendingRound(nextMessages: MessageView[], baselineSequence: number, expectedAssistantCount: number) {
    const persistedUserMessage = findNextUserMessageAfterSequence(nextMessages, baselineSequence);
    const completedAssistantReplies = persistedUserMessage
      ? listAssistantRepliesForUserMessage(nextMessages, persistedUserMessage.sequence)
      : [];
    const repliedModelIds = persistedUserMessage
      ? listAssistantReplyModelIdsForUserMessage(nextMessages, persistedUserMessage.sequence)
      : [];

    applyPendingRoundState({
      baselineSequence,
      userSequence: persistedUserMessage?.sequence ?? null,
      completedAssistantCount: completedAssistantReplies.length,
      expectedAssistantCount,
      repliedModelIds,
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
      if (!roomEventStreamConnectedRef.current) {
        try {
          const [nextRoom, nextMessages] = await Promise.all([fetchRoomState(), fetchMessagesState()]);
          applyRoomState(nextRoom);
          applyMessagesState(nextMessages);
          syncPendingRound(nextMessages, baselineSequence, expectedAssistantCount);
        } catch {}
      }

      if (!settled) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
    }
  }

  async function reconcileInterruptedSend(baselineSequence: number, expectedAssistantCount: number) {
    let latestRoom: RoomView | null = null;
    let latestMessages: MessageView[] = [];
    let persistedUserMessage: MessageView | null = null;
    let assistantReplies: MessageView[] = [];
    let lastObservedSignature: string | null = null;
    let stablePollCount = 0;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const [nextRoom, nextMessages] = await Promise.all([fetchRoomState(), fetchMessagesState()]);
        latestRoom = nextRoom;
        latestMessages = nextMessages;
        applyRoomState(nextRoom);
        applyMessagesState(nextMessages);

        persistedUserMessage = findNextUserMessageAfterSequence(nextMessages, baselineSequence);
        assistantReplies = persistedUserMessage
          ? listAssistantRepliesForUserMessage(nextMessages, persistedUserMessage.sequence)
          : [];

        if (persistedUserMessage) {
          syncPendingRound(nextMessages, baselineSequence, expectedAssistantCount);
        }

        const snapshotSignature = [
          persistedUserMessage?.id ?? "no-user",
          assistantReplies.length,
          nextMessages.at(-1)?.id ?? "no-message",
          ...nextRoom.roomModels.map(
            (roomModel) =>
              `${roomModel.modelId}:${roomModel.executionState}:${roomModel.cooldownUntil ?? ""}:${roomModel.model.enabled}`,
          ),
        ].join("|");

        stablePollCount = snapshotSignature === lastObservedSignature ? stablePollCount + 1 : 0;
        lastObservedSignature = snapshotSignature;

        const roundLooksStable =
          Boolean(persistedUserMessage) &&
          (
            assistantReplies.length >= expectedAssistantCount ||
            stablePollCount >= 5
          );

        if (roundLooksStable) {
          break;
        }
      } catch {
        // 请求中断后补偿同步尽量自愈；若本轮都失败，再由外层走常规错误提示。
      }

      if (attempt < 9) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    return {
      acceptedByServer: Boolean(persistedUserMessage),
      room: latestRoom,
      messages: latestMessages,
      persistedUserMessage,
      assistantReplies,
    };
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

  const pollCurrentRoundState = useEffectEvent(async () => {
    const [nextRoom, nextMessages] = await Promise.all([fetchRoomState(), fetchMessagesState()]);
    applyRoomState(nextRoom);
    applyMessagesState(nextMessages);
    return nextRoom.currentRound?.status === "RUNNING";
  });

  const handleRoomStreamSnapshot = useEffectEvent(async (nextRoom: RoomView) => {
    const previousMessageCount = roomStateRef.current?.messageCount ?? messagesRef.current.length;
    const shouldRefreshMessages = nextRoom.messageCount !== previousMessageCount || nextRoom.messageCount !== messagesRef.current.length;

    applyRoomState(nextRoom);

    if (!shouldRefreshMessages) {
      return;
    }

    const nextMessages = await fetchMessagesState();
    applyMessagesState(nextMessages);

    if (pendingRoundRef.current) {
      syncPendingRound(
        nextMessages,
        pendingRoundRef.current.baselineSequence,
        pendingRoundRef.current.expectedAssistantCount,
      );
    }
  });

  const handleRoomRoundEvent = useEffectEvent(async (nextEvent: ConversationRoundEventView) => {
    const shouldRefreshMessages =
      nextEvent.eventType === "ROUND_CREATED" ||
      nextEvent.eventType === "STEP_REPLIED" ||
      nextEvent.eventType === "ROUND_COMPLETED" ||
      nextEvent.eventType === "ROUND_PARTIAL" ||
      nextEvent.eventType === "ROUND_FAILED";

    if (shouldRefreshMessages) {
      const [nextRoom, nextMessages] = await Promise.all([fetchRoomState(), fetchMessagesState()]);
      applyRoomState(nextRoom);
      applyMessagesState(nextMessages);

      if (pendingRoundRef.current) {
        syncPendingRound(
          nextMessages,
          pendingRoundRef.current.baselineSequence,
          pendingRoundRef.current.expectedAssistantCount,
        );
      }

      return;
    }

    const nextRoom = await fetchRoomState();
    applyRoomState(nextRoom);
  });

  useEffect(() => {
    startTransition(() => {
      void handleInitialLoad();
    });
  }, [roomId]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    let disposed = false;
    const eventSource = new EventSource(`/api/rooms/${roomId}/events`);

    const handleSnapshotEvent = (event: MessageEvent<string>) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as RoomStreamSnapshotView;
        void handleRoomStreamSnapshot(payload.room);
      } catch {
        // SSE 载荷解析失败时，退回到现有轮询兜底，不阻塞页面继续工作。
      }
    };

    const handleRoundEvent = (event: MessageEvent<string>) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as RoomRoundEventStreamView;
        void handleRoomRoundEvent(payload.event);
      } catch {
        // 事件解析失败时，保留现有兜底轮询，不额外中断页面交互。
      }
    };

    eventSource.onopen = () => {
      if (disposed) {
        return;
      }

      roomEventStreamConnectedRef.current = true;
      setHasRoomEventStream(true);
    };

    eventSource.addEventListener("room-snapshot", handleSnapshotEvent as EventListener);
    eventSource.addEventListener("round-event", handleRoundEvent as EventListener);

    eventSource.onerror = () => {
      if (disposed) {
        return;
      }

      roomEventStreamConnectedRef.current = false;
      setHasRoomEventStream(false);
    };

    return () => {
      disposed = true;
      roomEventStreamConnectedRef.current = false;
      setHasRoomEventStream(false);
      eventSource.removeEventListener("room-snapshot", handleSnapshotEvent as EventListener);
      eventSource.removeEventListener("round-event", handleRoundEvent as EventListener);
      eventSource.close();
    };
  }, [roomId]);

  useEffect(() => {
    if (hasRoomEventStream || !room?.currentRound || room.currentRound.status !== "RUNNING" || isSending) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollCurrentRound = async () => {
      try {
        const shouldContinue = await pollCurrentRoundState();

        if (cancelled) {
          return;
        }

        if (shouldContinue) {
          timeoutId = setTimeout(() => {
            void pollCurrentRound();
          }, 700);
        }
      } catch {
        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void pollCurrentRound();
          }, 1000);
        }
      }
    };

    timeoutId = setTimeout(() => {
      void pollCurrentRound();
    }, 700);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasRoomEventStream, isSending, roomId, room?.currentRound]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.innerWidth >= 1024) {
      setShowSidePanel(true);
    }
  }, []);

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

  const runnableRoomModels = useMemo(
    () => orderedRoomModels.filter((roomModel) => roomModel.model.enabled && !isRoomModelCoolingDown(roomModel)),
    [orderedRoomModels],
  );

  const coolingDownRoomModels = useMemo(
    () => orderedRoomModels.filter((roomModel) => isRoomModelCoolingDown(roomModel)),
    [orderedRoomModels],
  );

  const halfOpenRoomModels = useMemo(
    () => orderedRoomModels.filter((roomModel) => isRoomModelHalfOpen(roomModel)),
    [orderedRoomModels],
  );

  const orderDirty = useMemo(() => {
    if (!room) return false;
    return room.roomModels.map((item) => item.modelId).join(",") !== draftModelIds.join(",");
  }, [draftModelIds, room]);

  const currentRound = room?.currentRound ?? null;

  const currentRoundStepByRoomModelId = useMemo(
    () => new Map((currentRound?.steps ?? []).map((step) => [step.roomModelId, step])),
    [currentRound],
  );

  const activeTimelineModel = useMemo(() => {
    const runningStep =
      currentRound?.steps.find((step) => step.status === "RUNNING") ??
      currentRound?.steps.find((step) => step.status === "PENDING");

    if (runningStep) {
      return orderedRoomModels.find((roomModel) => roomModel.id === runningStep.roomModelId)?.model ?? null;
    }

    if (!pendingRound || !isSending) return null;
    const total = Math.min(pendingRound.expectedAssistantCount, runnableRoomModels.length);
    const activeIndex = pendingRound.completedAssistantCount;
    if (activeIndex >= total) return null;
    return runnableRoomModels[activeIndex]?.model ?? null;
  }, [currentRound, isSending, orderedRoomModels, pendingRound, runnableRoomModels]);

  const completedRunnableModelIds = useMemo(() => {
    if (currentRound) {
      return new Set(
        currentRound.steps.filter((step) => step.status === "REPLIED").map((step) => step.modelId),
      );
    }

    if (!pendingRound || !isSending) {
      return new Set<string>();
    }

    return new Set(pendingRound.repliedModelIds);
  }, [currentRound, isSending, pendingRound]);

  const currentRoundProgress = useMemo(() => {
    if (!currentRound || currentRound.status !== "RUNNING") {
      return null;
    }

    const participatingSteps = currentRound.steps.filter((step) => step.status !== "SKIPPED");

    return {
      completedCount: participatingSteps.filter(isRoundStepCompleted).length,
      totalCount: participatingSteps.length,
    };
  }, [currentRound]);

  const lastRoundOutcomeByModelId = useMemo(() => {
    return new Map((lastRoundResult?.roundOutcomes ?? []).map((outcome) => [outcome.modelId, outcome]));
  }, [lastRoundResult]);

  const roomModelAlerts = useMemo(
    () =>
      orderedRoomModels
        .map((roomModel) => {
          const insight = getModelOperationalInsight(roomModel.model);
          return insight ? { modelName: roomModel.model.name, insight } : null;
        })
        .filter((item): item is { modelName: string; insight: NonNullable<ReturnType<typeof getModelOperationalInsight>> } => Boolean(item)),
    [orderedRoomModels],
  );

  const sidebarHeadline = useMemo(() => {
    if (currentRound?.status === "RUNNING" && activeTimelineModel) {
      return {
        label: "当前轮到",
        name: activeTimelineModel.name,
        tone: "active" as const,
      };
    }

    if (isSending && activeTimelineModel) {
      return {
        label: "当前轮到",
        name: activeTimelineModel.name,
        tone: "active" as const,
      };
    }

    const failedOutcome = lastRoundResult?.roundOutcomes.find((outcome) => outcome.outcome === "failed");

    if (failedOutcome) {
      return {
        label: "最近失败",
        name: failedOutcome.modelName,
        tone: "failed" as const,
      };
    }

    const latestReplyOutcome = [...(lastRoundResult?.roundOutcomes ?? [])].reverse().find((outcome) => outcome.outcome === "replied");

    if (latestReplyOutcome) {
      return {
        label: "最近完成",
        name: latestReplyOutcome.modelName,
        tone: "idle" as const,
      };
    }

    return null;
  }, [activeTimelineModel, currentRound, isSending, lastRoundResult]);

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
      applyRoomState(data.room);
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
      applyRoomState(data.room);
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
    const expectedAssistantCount = runnableRoomModels.length;

    if (expectedAssistantCount === 0) {
      setPendingUserContent("");
      setFeedback({
        title: "当前没有可运行的模型",
        description: "这个房间里的模型目前都处于冷却中或已停用，所以本轮无法继续发起顺序回复。",
        suggestion: "请等待冷却结束，或先在模型页恢复/启用至少一个健康模型后再继续。",
        tone: "warning",
      });
      return;
    }

    setActiveAction("sending");
    setFeedback(null);
    setLastRoundResult(null);
    applyPendingRoundState({
      baselineSequence,
      userSequence: null,
      completedAssistantCount: 0,
      expectedAssistantCount,
      repliedModelIds: [],
    });

    try {
      const requestPromise = sendRoomMessageRequest(room.id, content);
      await watchSequentialReplies(baselineSequence, expectedAssistantCount, requestPromise);
      const result = await requestPromise;
      setLastRoundResult(result);
      await Promise.all([loadMessages(), loadRoom()]);
      applyPendingRoundState(null);
      setPendingUserContent("");

      if (result.status === "partial") {
        setFeedback(describePartialSendResult(result));
      } else {
        setFeedback(describeSkippedModelsResult(result));
      }
    } catch (error: unknown) {
      const recovery = await reconcileInterruptedSend(baselineSequence, expectedAssistantCount);

      if (recovery.acceptedByServer) {
        setInput("");
        setPendingUserContent("");
        setLastRoundResult(null);
        applyPendingRoundState(null);
        setFeedback(
          describeInterruptedSendRecovery({
            expectedAssistantCount,
            assistantReplyCount: recovery.assistantReplies.length,
          }),
        );
      } else {
        setInput(content);
        setPendingUserContent("");
        applyPendingRoundState(null);
        setLastRoundResult(null);
        setFeedback(describeClientError(error));
      }
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

  const statusText = currentRoundProgress
    ? `正在回复 ${currentRoundProgress.completedCount}/${currentRoundProgress.totalCount}`
    : isSending
      ? `正在回复 ${pendingRound?.completedAssistantCount ?? 0}/${pendingRound?.expectedAssistantCount ?? 0}`
      : `${room?.roomModels.length ?? 0} 个模型 · ${toRoomLabel(room?.type ?? "SINGLE")}${
        coolingDownRoomModels.length > 0 ? ` · ${coolingDownRoomModels.length} 个冷却中` : ""
      }${halfOpenRoomModels.length > 0 ? ` · ${halfOpenRoomModels.length} 个试探恢复中` : ""}`;

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

            <button
              type="button"
              onClick={() => setShowSidePanel((current) => !current)}
              className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold transition lg:inline-flex ${
                showSidePanel
                  ? "border-[#DC75A5]/40 bg-[#FF8DA1]/12 text-[#DC75A5]"
                  : "border-white/40 bg-white/45 text-stone-600 hover:bg-white/60"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              {showSidePanel ? "隐藏执行链" : "显示执行链"}
            </button>

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
               {roomModelAlerts.length > 0 && (
                 <div className="space-y-3">
                   {roomModelAlerts.map(({ modelName, insight }) => (
                     <RoomModelAlert
                       key={`${modelName}-${insight.shortLabel}`}
                       modelName={modelName}
                       shortLabel={insight.shortLabel}
                       title={insight.title}
                       description={insight.description}
                       suggestion={insight.suggestion}
                       tone={insight.tone}
                     />
                   ))}
                 </div>
               )}

               {/* Empty chat state */}
               {messages.length === 0 && !pendingUserContent && (
                 <div className="flex flex-col items-center justify-center py-24 text-center">
                   <div className="ly-surface-card mb-6 flex h-16 w-16 items-center justify-center rounded-3xl">
                      <svg className="w-8 h-8 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                   </div>
                   <h2 className="text-2xl font-extrabold text-[#2f2e33] tracking-tight">开始多模型排演</h2>
                    <p className="mt-3 max-w-sm text-sm text-stone-500 leading-relaxed font-medium">
                      发送消息，当前可运行的 {runnableRoomModels.length} 个模型将依次分析并回复。
                      {coolingDownRoomModels.length > 0 ? ` 另有 ${coolingDownRoomModels.length} 个模型处于冷却中，会在后续轮次自动跳过。` : ""}
                      {halfOpenRoomModels.length > 0
                        ? ` 当前还有 ${halfOpenRoomModels.length} 个模型处于试探恢复状态，会先通过一次成功回复来恢复正常参与。`
                        : ""}
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
                  const replyDurationLabel = formatReplyDurationMs(message.replyDurationMs);
                  const queueDurationLabel = formatReplyDurationMs(message.replyTiming?.queueDurationMs ?? null);
                  const providerRequestDurationLabel = formatReplyDurationMs(
                    message.replyTiming?.providerRequestDurationMs ?? null,
                  );
                  const recoveryRequestDurationLabel = formatReplyDurationMs(
                    message.replyTiming?.recoveryRequestDurationMs ?? null,
                  );
                  const rewriteRequestDurationLabel = formatReplyDurationMs(
                    message.replyTiming?.rewriteRequestDurationMs ?? null,
                  );
                  const persistenceDurationLabel = formatReplyDurationMs(
                    message.replyTiming?.persistenceDurationMs ?? null,
                  );
                  const providerAttemptCount = message.replyTiming?.providerAttemptCount ?? null;
                  const replyTimingSegments = [
                    queueDurationLabel ? `排队 ${queueDurationLabel}` : null,
                    providerRequestDurationLabel ? `上游 ${providerRequestDurationLabel}` : null,
                    providerAttemptCount && providerAttemptCount > 1 ? `${providerAttemptCount} 次请求` : null,
                    recoveryRequestDurationLabel ? `补救 ${recoveryRequestDurationLabel}` : null,
                    rewriteRequestDurationLabel ? `改写 ${rewriteRequestDurationLabel}` : null,
                    persistenceDurationLabel ? `保存 ${persistenceDurationLabel}` : null,
                  ].filter((segment): segment is string => Boolean(segment));
                  const avatarPalette = provider
                    ? getModelAvatarPalette(provider, messageModel?.avatarColor ?? roomModel?.model.avatarColor)
                    : null;
                  const resolvedMessageAvatar = provider
                    ? resolveModelAvatar(
                        provider,
                        roomModel?.model.baseUrl ?? "",
                        messageModel?.avatarLabel ?? roomModel?.model.avatarLabel,
                        messageModel?.avatarColor ?? roomModel?.model.avatarColor,
                      )
                    : null;

                  return (
                     <article key={message.id} className="flex flex-col items-start gap-2 max-w-[90%] sm:max-w-3xl animate-chat-in">
                        <div className="flex items-center gap-2 px-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-[#2f2e33] tracking-wider uppercase flex items-center gap-1.5 shadow-sm border ${providerBadgeClassName}`}>
                            {provider && (
                              <span
                                className="inline-flex items-center justify-center rounded px-1 text-[8px] font-bold"
                                style={
                                  avatarPalette
                                    ? {
                                        backgroundColor: avatarPalette.baseColor,
                                        color: avatarPalette.textColor,
                                      }
                                    : undefined
                                }
                              >
                                {resolvedMessageAvatar?.avatarLabel ?? getProviderShortName(provider)}
                              </span>
                            )}
                            {messageModel?.name ?? "AI 助手"}
                          </span>
                          <span className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">{formatDate(message.createdAt)}</span>
                          {replyDurationLabel && (
                            <span className="rounded-full border border-white/60 bg-white/65 px-2 py-0.5 text-[10px] font-bold text-stone-500">
                              本次 {replyDurationLabel}
                            </span>
                          )}
                        </div>
                        <div className={`rounded-3xl rounded-tl-md border p-4 text-[#2f2e33] sm:p-6 ${providerSoftClassName} ${providerSurfaceClassName}`}>
                          <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/50 pb-3">
                            <div className="flex items-center gap-2">
                              {provider && (
                                <span
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-bold shadow-sm"
                                  style={
                                    avatarPalette
                                      ? {
                                          backgroundColor: avatarPalette.baseColor,
                                          color: avatarPalette.textColor,
                                          boxShadow: `0 8px 18px ${avatarPalette.shadowColor}`,
                                        }
                                      : undefined
                                  }
                                >
                                  {resolvedMessageAvatar?.avatarLabel ?? getProviderShortName(provider)}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-bold tracking-tight text-[#2f2e33]">
                                  {messageModel?.name ?? "AI 助手"}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-stone-500">
                                  <span>{provider ? formatReplyLength(messageModel?.defaultReplyLength ?? roomModel?.model.defaultReplyLength ?? 0) : "模型回复"}</span>
                                  {replyDurationLabel && <span>• 本次 {replyDurationLabel}</span>}
                                </div>
                                {replyTimingSegments.length > 0 && (
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-stone-400">
                                    {replyTimingSegments.map((segment) => (
                                      <span key={`${message.id}-${segment}`}>• {segment}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {provider && (
                              <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${providerBadgeClassName}`}>
                                {resolvedMessageAvatar?.avatarLabel ?? getProviderShortName(provider)}
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
                     data-testid="room-composer-input"
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
                     data-testid="room-composer-send"
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
             
              <aside
                data-testid="room-execution-chain"
                className="ly-glass absolute inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-white/45 shadow-2xl md:static md:z-10 md:shadow-none animate-slide-in"
              >
                <div className="ly-soft-card m-4 mb-0 flex shrink-0 items-center justify-between p-4 sm:p-5">
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-[#2f2e33] flex items-center gap-2 text-[14px] tracking-widest uppercase">
                      <svg className="w-5 h-5 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      当前执行模型
                    </h2>
                    {sidebarHeadline && (
                      <>
                        <p
                          data-testid="room-sidebar-headline-label"
                          className={`mt-1 text-[10px] font-bold tracking-[0.24em] uppercase ${
                            sidebarHeadline.tone === "failed"
                              ? "text-rose-500"
                              : sidebarHeadline.tone === "active"
                                ? "text-[#DC75A5]"
                                : "text-stone-400"
                          }`}
                        >
                          {sidebarHeadline.label}
                        </p>
                        <p
                          data-testid="room-sidebar-headline-name"
                          className={`truncate text-[14px] font-extrabold ${
                            sidebarHeadline.tone === "failed"
                              ? "text-rose-700"
                              : sidebarHeadline.tone === "active"
                                ? "text-[#2f2e33]"
                                : "text-stone-600"
                          }`}
                        >
                          {sidebarHeadline.name}
                        </p>
                      </>
                    )}
                  </div>
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
                       const currentRoundStep = currentRoundStepByRoomModelId.get(roomModel.id);
                       const isCurrent =
                         currentRoundStep?.status === "RUNNING" ||
                         (isSending && !currentRound && activeTimelineModel?.id === roomModel.model.id);
                       const isDone =
                         currentRoundStep?.status === "REPLIED" ||
                         (isSending && !currentRound && completedRunnableModelIds.has(roomModel.modelId));
                       const failedDuringCurrentRound = currentRoundStep?.status === "FAILED";
                       const skippedDuringCurrentRound = currentRoundStep?.status === "SKIPPED";
                       const provider = roomModel.model.provider;
                       const providerSoftClassName = getProviderSoftClassName(provider);
                       const providerSurfaceClassName = getProviderMessageSurfaceClassName(provider);
                       const providerAccentClassName = getProviderAccentClassName(provider);
                       const resolvedRoomAvatar = resolveModelAvatar(
                         provider,
                         roomModel.model.baseUrl,
                         roomModel.model.avatarLabel,
                         roomModel.model.avatarColor,
                       );
                       const avatarPalette = getModelAvatarPalette(provider, resolvedRoomAvatar.avatarColor);
                      const modelInsight = getModelOperationalInsight(roomModel.model);
                      const totalReplyDurationLabel = formatReplyDurationMs(roomModel.replyMetrics.totalReplyDurationMs);
                      const averageReplyDurationLabel = formatReplyDurationMs(roomModel.replyMetrics.averageReplyDurationMs);
                      const averageQueueDurationLabel = formatReplyDurationMs(roomModel.replyMetrics.averageQueueDurationMs);
                      const averageProviderRequestDurationLabel = formatReplyDurationMs(
                        roomModel.replyMetrics.averageProviderRequestDurationMs,
                      );
                      const timeoutCount = roomModel.replyMetrics.timeoutCount;
                      const lastFailureLabel = roomModel.lastFailure
                        ? `${formatFailureKindLabel(roomModel.lastFailure.kind)} · ${formatDate(roomModel.lastFailure.occurredAt)}`
                        : null;
                      const lastSuccessLabel = roomModel.lastSuccessAt ? formatDate(roomModel.lastSuccessAt) : null;
                      const lastRecoveryLabel = roomModel.lastRecoveryAt ? formatDate(roomModel.lastRecoveryAt) : null;
                      const isCoolingDown = isRoomModelCoolingDown(roomModel);
                      const isHalfOpen = isRoomModelHalfOpen(roomModel);
                      const cooldownLabel = roomModel.cooldownUntil ? formatDate(roomModel.cooldownUntil) : null;
                      const lastRoundOutcome = lastRoundOutcomeByModelId.get(roomModel.modelId);
                      const hasPersistentFailure = Boolean(roomModel.lastFailure) && !isCoolingDown && !isHalfOpen;
                      const failedThisRound = lastRoundOutcome?.outcome === "failed";
                      const wasRepliedLastRound = !isSending && lastRoundOutcome?.outcome === "replied";
                      const effectiveCooldownUntilLabel = lastRoundOutcome?.cooldownUntil
                        ? formatDate(lastRoundOutcome.cooldownUntil)
                        : cooldownLabel;
                      const failureDetail = failedDuringCurrentRound
                        ? currentRoundStep?.errorMessage ?? "该模型本轮未能成功完成回复。"
                        : lastRoundOutcome?.outcome === "failed"
                          ? lastRoundOutcome.error ?? roomModel.lastFailure?.message ?? "该模型本轮未能成功完成回复。"
                          : roomModel.lastFailure?.message ?? null;
                      const showFailureOverlay =
                        !isCurrent &&
                        (failedDuringCurrentRound || failedThisRound || hasPersistentFailure || Boolean(lastRoundOutcome?.paused));
                      const statusToneClass = isCurrent
                        ? `${providerAccentClassName} text-white`
                        : lastRoundOutcome?.paused
                          ? "bg-rose-100 text-rose-700"
                        : isCoolingDown
                          ? "bg-amber-100 text-amber-700"
                        : lastRoundOutcome?.cooldownUntil
                          ? "bg-amber-100 text-amber-700"
                        : isHalfOpen
                            ? "bg-sky-100 text-sky-700"
                            : !roomModel.model.enabled
                                  ? "bg-stone-200 text-stone-500"
                                  : failedDuringCurrentRound || failedThisRound || hasPersistentFailure
                                    ? "bg-red-100 text-red-700"
                                  : isDone || wasRepliedLastRound
                                    ? "bg-[#FF8DA1]/20 text-[#DC75A5]"
                                  : "bg-stone-100 text-stone-500";
                      const statusLabel = isCurrent
                        ? "正在思考"
                        : lastRoundOutcome?.paused
                          ? "已暂停"
                        : isCoolingDown
                          ? "冷却中"
                        : lastRoundOutcome?.cooldownUntil
                          ? "冷却中"
                        : isHalfOpen
                          ? "试探恢复"
                          : skippedDuringCurrentRound
                            ? roomModel.model.enabled
                              ? "跳过"
                              : "已停用"
                              : !roomModel.model.enabled
                                  ? "已停用"
                                  : failedDuringCurrentRound || failedThisRound || hasPersistentFailure
                                    ? "失败"
                                  : isDone || wasRepliedLastRound
                                    ? "完成"
                                    : "待命";
                      const timelineDotClass = isCurrent
                        ? `${providerAccentClassName} scale-125 shadow-[0_0_0_2px_rgba(255,255,255,0.55)]`
                        : lastRoundOutcome?.paused
                          ? "bg-rose-500"
                        : isCoolingDown
                          ? "bg-amber-400"
                        : lastRoundOutcome?.cooldownUntil
                          ? "bg-amber-400"
                        : isHalfOpen
                          ? "bg-sky-400"
                            : skippedDuringCurrentRound
                              ? roomModel.model.enabled
                                ? "bg-stone-300"
                                : "bg-stone-400"
                              : !roomModel.model.enabled
                                ? "bg-stone-400"
                                : failedDuringCurrentRound || failedThisRound || hasPersistentFailure
                                  ? "bg-red-400"
                                : isDone || wasRepliedLastRound
                                  ? providerAccentClassName
                                  : "bg-stone-300";

                       return (
                        <div
                          key={roomModel.id}
                          data-testid={`room-model-card-${roomModel.modelId}`}
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
                          <div className={`absolute -left-[33px] top-[18px] w-3.5 h-3.5 rounded-full border-[3px] z-10 box-border border-[#f9f5fc] transition-colors duration-500 ${timelineDotClass}`}></div>
                          
                          <div className={`relative p-4 rounded-2xl border transition-all duration-300 ${
                            dragOverModelId === roomModel.modelId && draggedModelId !== roomModel.modelId
                              ? "border-[#DC75A5] bg-white/50 scale-[1.02]"
                              : isCurrent 
                              ? `${providerSoftClassName} ${providerSurfaceClassName} ring-1 ring-white/40`
                              : showFailureOverlay
                                ? "border-red-200/80 bg-red-50/75 shadow-[0_10px_30px_rgba(239,68,68,0.10)]"
                              : `${providerSoftClassName} ${providerSurfaceClassName} hover:shadow-md`
                            }`}
                          >
                            {showFailureOverlay && !isCurrent && (
                              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-red-100/65 via-red-50/45 to-transparent" />
                            )}
                            <div className="relative">
                            <div className="flex items-start justify-between mb-2">
                               <h4 className="text-[12px] font-extrabold uppercase tracking-tighter text-[#2f2e33]">
                                  {index + 1}. {roomModel.model.name}
                               </h4>
                               <span
                                 data-testid={`room-model-status-${roomModel.modelId}`}
                                 className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusToneClass}`}
                               >
                                 {statusLabel}
                               </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-stone-500 font-medium tracking-wide border-t border-stone-100 pt-2 mt-1">
                               <span
                                 className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] text-[7px] font-bold"
                                 style={{
                                   backgroundColor: avatarPalette.baseColor,
                                   color: avatarPalette.textColor,
                                 }}
                               >
                                 {resolvedRoomAvatar.avatarLabel}
                               </span>
                               <span>预设字数: {formatReplyLength(roomModel.model.defaultReplyLength)}</span>
                            </div>
                            <div className="mt-2 rounded-xl border border-white/45 bg-white/55 px-3 py-2 text-[10px] font-medium text-stone-500">
                              {roomModel.replyMetrics.replyCount > 0 || timeoutCount > 0 ? (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span>累计 {totalReplyDurationLabel ?? "—"}</span>
                                  <span>平均 {averageReplyDurationLabel ?? "—"}</span>
                                  <span>平均排队 {averageQueueDurationLabel ?? "—"}</span>
                                  <span>平均上游 {averageProviderRequestDurationLabel ?? "—"}</span>
                                  <span>{roomModel.replyMetrics.replyCount} 次回复</span>
                                  {lastSuccessLabel && <span>最近成功 {lastSuccessLabel}</span>}
                                  {timeoutCount > 0 && <span className="font-bold text-amber-600">超时 {timeoutCount} 次</span>}
                                </div>
                              ) : (
                                <span>{room?.messageCount ? "历史消息未记录耗时，后续回复会开始统计" : "暂无线程内回复耗时统计"}</span>
                              )}
                            </div>
                            {(failedThisRound || hasPersistentFailure) && failureDetail && (
                              <div className="mt-2 rounded-xl border border-red-200/70 bg-red-50/80 px-3 py-2 text-[10px] font-medium text-red-800">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-bold">本轮状态</span>
                                  <span>{lastRoundOutcome?.paused ? "已暂停" : lastRoundOutcome?.cooldownUntil ? "失败并冷却" : "回复失败"}</span>
                                  {lastRoundOutcome?.cooldownUntil && <span>恢复于 {effectiveCooldownUntilLabel}</span>}
                                </div>
                                <p className="mt-1 line-clamp-3 leading-relaxed text-red-900/85">{failureDetail}</p>
                              </div>
                            )}
                            {(isCoolingDown || Boolean(lastRoundOutcome?.cooldownUntil)) && (
                              <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-[10px] font-medium text-amber-800">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-bold">当前状态</span>
                                  <span>冷却中</span>
                                  {effectiveCooldownUntilLabel && <span>恢复于 {effectiveCooldownUntilLabel}</span>}
                                  <span>连续失败 {roomModel.consecutiveFailureCount} 次</span>
                                </div>
                                <p className="mt-1 leading-relaxed text-amber-900/80">
                                  这个模型在当前房间最近连续失败，后续轮次会先跳过它，避免继续卡住其他健康模型。
                                </p>
                              </div>
                            )}
                            {isHalfOpen && (
                              <div className="mt-2 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-[10px] font-medium text-sky-800">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-bold">当前状态</span>
                                  <span>试探恢复中</span>
                                  <span>连续失败 {roomModel.consecutiveFailureCount} 次后恢复试探</span>
                                </div>
                                <p className="mt-1 leading-relaxed text-sky-900/80">
                                  这个模型的冷却窗口已经结束，本轮会先用一次试探性回复来验证是否恢复稳定。成功后会恢复正常参与。
                                </p>
                              </div>
                            )}
                            {lastRecoveryLabel && !isCoolingDown && !isHalfOpen && (
                              <div className="mt-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-[10px] font-medium text-emerald-800">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-bold">最近恢复</span>
                                  <span>{lastRecoveryLabel}</span>
                                </div>
                                <p className="mt-1 leading-relaxed text-emerald-900/80">
                                  这个模型已经通过最近一次成功回复恢复正常参与，可以继续观察它后续是否保持稳定。
                                </p>
                              </div>
                            )}
                            {roomModel.lastFailure && (
                              <div className="mt-2 rounded-xl border border-rose-200/60 bg-rose-50/70 px-3 py-2 text-[10px] font-medium text-rose-700">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-bold">最近失败</span>
                                  <span>{lastFailureLabel}</span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-rose-800/85">
                                  {roomModel.lastFailure.message}
                                </p>
                              </div>
                            )}
                            {modelInsight && (
                              <div
                                className={`mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5 ${
                                  modelInsight.tone === "warning"
                                    ? "border-amber-200/70 bg-amber-50/80 text-amber-900"
                                    : "border-red-200/70 bg-red-50/80 text-red-900"
                                }`}
                              >
                                <p className="font-bold">{modelInsight.shortLabel} · {modelInsight.title}</p>
                                <p className="mt-1 opacity-80">{modelInsight.description}</p>
                              </div>
                            )}
                            {isCurrent && (
                              <div className="mt-3 flex items-center gap-2">
                                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/65">
                                  <div className={`absolute inset-y-0 left-0 w-1/2 rounded-full animate-[slideRight_1.5s_infinite_ease-in-out] ${providerAccentClassName}`} />
                                </div>
                              </div>
                            )}
                            </div>
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
