import { getModelOperationalInsight } from "@/lib/client/longyuchat-client";

import {
  isRoomModelCoolingDown,
  isRoomModelHalfOpen,
  isRoundStepCompleted,
} from "@/components/room-chat/room-chat-helpers";
import type { RoomView, SendRoomMessageResult } from "@/types/app";

export interface PendingRoundState {
  baselineSequence: number;
  userSequence: number | null;
  completedAssistantCount: number;
  expectedAssistantCount: number;
  repliedModelIds: string[];
}

type CurrentConversationRound = NonNullable<RoomView["currentRound"]>;

export function getOrderedRoomModels(room: RoomView | null, draftModelIds: string[]) {
  if (!room) {
    return [] as RoomView["roomModels"];
  }

  return draftModelIds
    .map((modelId) => room.roomModels.find((roomModel) => roomModel.modelId === modelId))
    .filter((roomModel): roomModel is RoomView["roomModels"][number] => Boolean(roomModel));
}

export function getRunnableRoomModels(
  orderedRoomModels: RoomView["roomModels"],
  now = new Date(),
) {
  return orderedRoomModels.filter(
    (roomModel) => roomModel.model.enabled && !isRoomModelCoolingDown(roomModel, now),
  );
}

export function getCoolingDownRoomModels(
  orderedRoomModels: RoomView["roomModels"],
  now = new Date(),
) {
  return orderedRoomModels.filter((roomModel) => isRoomModelCoolingDown(roomModel, now));
}

export function getHalfOpenRoomModels(orderedRoomModels: RoomView["roomModels"]) {
  return orderedRoomModels.filter((roomModel) => isRoomModelHalfOpen(roomModel));
}

export function getOrderDirty(room: RoomView | null, draftModelIds: string[]) {
  if (!room) {
    return false;
  }

  return room.roomModels.map((item) => item.modelId).join(",") !== draftModelIds.join(",");
}

export function getCurrentRoundStepByRoomModelId(currentRound: CurrentConversationRound | null) {
  return new Map((currentRound?.steps ?? []).map((step) => [step.roomModelId, step]));
}

export function getActiveTimelineModel(input: {
  currentRound: CurrentConversationRound | null;
  isSending: boolean;
  orderedRoomModels: RoomView["roomModels"];
  pendingRound: PendingRoundState | null;
  runnableRoomModels: RoomView["roomModels"];
}) {
  const runningStep =
    input.currentRound?.steps.find((step) => step.status === "RUNNING") ??
    input.currentRound?.steps.find((step) => step.status === "PENDING");

  if (runningStep) {
    return input.orderedRoomModels.find((roomModel) => roomModel.id === runningStep.roomModelId)?.model ?? null;
  }

  if (!input.pendingRound || !input.isSending) {
    return null;
  }

  const total = Math.min(input.pendingRound.expectedAssistantCount, input.runnableRoomModels.length);
  const activeIndex = input.pendingRound.completedAssistantCount;

  if (activeIndex >= total) {
    return null;
  }

  return input.runnableRoomModels[activeIndex]?.model ?? null;
}

export function getCompletedRunnableModelIds(
  currentRound: CurrentConversationRound | null,
  pendingRound: PendingRoundState | null,
  isSending: boolean,
) {
  if (currentRound) {
    return new Set(currentRound.steps.filter((step) => step.status === "REPLIED").map((step) => step.modelId));
  }

  if (!pendingRound || !isSending) {
    return new Set<string>();
  }

  return new Set(pendingRound.repliedModelIds);
}

export function getCurrentRoundProgress(currentRound: CurrentConversationRound | null) {
  if (!currentRound || currentRound.status !== "RUNNING") {
    return null;
  }

  const participatingSteps = currentRound.steps.filter((step) => step.status !== "SKIPPED");

  return {
    completedCount: participatingSteps.filter(isRoundStepCompleted).length,
    totalCount: participatingSteps.length,
  };
}

export function getLastRoundOutcomeByModelId(lastRoundResult: SendRoomMessageResult | null) {
  return new Map((lastRoundResult?.roundOutcomes ?? []).map((outcome) => [outcome.modelId, outcome]));
}

export function getRoomModelAlerts(orderedRoomModels: RoomView["roomModels"]) {
  return orderedRoomModels
    .map((roomModel) => {
      const insight = getModelOperationalInsight(roomModel.model);
      return insight ? { modelName: roomModel.model.name, insight } : null;
    })
    .filter(
      (
        item,
      ): item is {
        modelName: string;
        insight: NonNullable<ReturnType<typeof getModelOperationalInsight>>;
      } => Boolean(item),
    );
}

export function getSidebarHeadline(input: {
  activeTimelineModel: RoomView["roomModels"][number]["model"] | null;
  currentRound: CurrentConversationRound | null;
  isSending: boolean;
  lastRoundResult: SendRoomMessageResult | null;
}) {
  if (input.currentRound?.status === "RUNNING" && input.activeTimelineModel) {
    return {
      label: "当前轮到",
      name: input.activeTimelineModel.name,
      tone: "active" as const,
    };
  }

  if (input.isSending && input.activeTimelineModel) {
    return {
      label: "当前轮到",
      name: input.activeTimelineModel.name,
      tone: "active" as const,
    };
  }

  const failedOutcome = input.lastRoundResult?.roundOutcomes.find((outcome) => outcome.outcome === "failed");

  if (failedOutcome) {
    return {
      label: "最近失败",
      name: failedOutcome.modelName,
      tone: "failed" as const,
    };
  }

  const latestReplyOutcome = [...(input.lastRoundResult?.roundOutcomes ?? [])]
    .reverse()
    .find((outcome) => outcome.outcome === "replied");

  if (latestReplyOutcome) {
    return {
      label: "最近完成",
      name: latestReplyOutcome.modelName,
      tone: "idle" as const,
    };
  }

  return null;
}
