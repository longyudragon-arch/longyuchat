import type { ChatRoom, ChatRoomModel, Message, ModelConfig } from "@/generated/prisma/client";
import { ConversationRoundStatus, ConversationRoundStepStatus } from "@/generated/prisma/enums";
import { createModelAdapter } from "@/server/adapters/openai-compatible-adapter";
import { ApiError } from "@/server/http/api-error";
import {
  inferProviderErrorKindFromMessage,
  isProviderTimeoutLikeMessage,
  shouldPauseModelOnProviderErrorKind,
} from "@/server/http/provider-error";
import { logServerEvent } from "@/server/observability/server-logger";
import { runSequentialConversation } from "@/server/orchestrators/conversation-orchestrator";
import {
  createConversationRound,
  finishConversationRound,
  markConversationRoundFailed,
  markConversationRoundStepFailed,
  markConversationRoundStepReplied,
  markConversationRoundStepRunning,
} from "@/server/services/conversation-round-service";
import {
  buildRoomModelCooldownUntil,
  clearRoomModelFailure,
  getChatRoomById,
  incrementRoomModelTimeoutCount,
  markRoomModelInCooldown,
  recordRoomModelFailure,
  resolveRoomModelExecutionState,
} from "@/server/services/chat-room-service";
import { createAssistantMessage, createUserMessage, listMessagesByRoomId } from "@/server/services/message-service";
import { pauseModelConfig, toModelRuntimeConfig } from "@/server/services/model-config-service";
import type { ChatMessage, ConversationHistoryMessage, ReplyTimingDetails } from "@/types/chat";

type RoomWithModels = ChatRoom & {
  roomModels: Array<ChatRoomModel & { model: ModelConfig }>;
};

interface SendRoomMessageDependencies {
  getRoomById: (roomId: string) => Promise<RoomWithModels | null>;
  listMessagesByRoomId: (roomId: string) => Promise<Array<Message & { model?: ModelConfig | null }>>;
  createUserMessage: (roomId: string, content: string) => Promise<Message>;
  createAssistantMessage: (
    roomId: string,
    modelId: string,
    content: string,
    replyDurationMs?: number | null,
    speaker?: {
      name: string;
      provider: ModelConfig["provider"];
      modelName: string;
      avatarLabel: string;
      avatarColor: string;
    },
    replyTiming?: ReplyTimingDetails | null,
  ) => Promise<Message>;
  createAdapter: typeof createModelAdapter;
  pauseModel: (modelId: string, reason: string) => Promise<ModelConfig>;
  recordRoomModelTimeout: (roomId: string, modelId: string) => Promise<void>;
  recordRoomModelFailure: (
    roomId: string,
    modelId: string,
    failure: {
      kind: string;
      message: string;
      occurredAt: Date;
    },
  ) => Promise<void>;
  markRoomModelInCooldown?: (
    roomId: string,
    modelId: string,
    failure: {
      kind: string;
      message: string;
      occurredAt: Date;
    },
  ) => Promise<Date>;
  clearRoomModelFailure: (roomId: string, modelId: string) => Promise<void>;
  createConversationRound?: typeof createConversationRound;
  markConversationRoundStepRunning?: typeof markConversationRoundStepRunning;
  markConversationRoundStepReplied?: typeof markConversationRoundStepReplied;
  markConversationRoundStepFailed?: typeof markConversationRoundStepFailed;
  finishConversationRound?: typeof finishConversationRound;
  markConversationRoundFailed?: typeof markConversationRoundFailed;
}

const defaultDependencies: SendRoomMessageDependencies = {
  getRoomById: getChatRoomById,
  listMessagesByRoomId,
  createUserMessage,
  createAssistantMessage,
  createAdapter: createModelAdapter,
  pauseModel: pauseModelConfig,
  recordRoomModelTimeout: incrementRoomModelTimeoutCount,
  recordRoomModelFailure,
  markRoomModelInCooldown,
  clearRoomModelFailure,
  createConversationRound,
  markConversationRoundStepRunning,
  markConversationRoundStepReplied,
  markConversationRoundStepFailed,
  finishConversationRound,
  markConversationRoundFailed,
};

const activeRoomSends = new Set<string>();

function acquireRoomSendLock(roomId: string) {
  if (activeRoomSends.has(roomId)) {
    throw new ApiError(409, `Room ${roomId} is already processing another message. Please wait for the current round to finish.`, {
      reasonCode: "room_message_in_flight",
      retryable: true,
      fieldHints: ["roomId"],
      roomId,
    });
  }

  activeRoomSends.add(roomId);

  return () => {
    activeRoomSends.delete(roomId);
  };
}

function toHistoryMessage(message: Message & { model?: ModelConfig | null }): ConversationHistoryMessage {
  return {
    role: message.role.toLowerCase() as ConversationHistoryMessage["role"],
    content: message.content,
    modelId: message.modelId,
    sequence: message.sequence,
    speakerName: message.speakerName ?? message.model?.name ?? null,
    speakerProvider: message.speakerProvider ?? message.model?.provider ?? null,
    speakerModelName: message.speakerModelName ?? message.model?.modelName ?? null,
  };
}

function assertRunnableRoom(room: RoomWithModels | null, roomId: string) {
  if (!room) {
    throw new ApiError(404, `Room ${roomId} was not found.`, {
      reasonCode: "room_not_found",
      retryable: false,
      fieldHints: ["roomId"],
      roomId,
    });
  }

  if (room.roomModels.length === 0) {
    throw new ApiError(400, `Room ${roomId} does not have any bound models.`, {
      reasonCode: "room_has_no_models",
      retryable: false,
      fieldHints: ["roomId", "modelId"],
      roomId,
    });
  }

  return room;
}

function isRoomModelCoolingDown(roomModel: RoomWithModels["roomModels"][number], now: Date) {
  return resolveRoomModelExecutionState(roomModel.executionState, roomModel.cooldownUntil, now) === "COOLDOWN";
}

function buildRunnableRoomSelection(room: RoomWithModels, now = new Date()) {
  const normalizedRoomModels = room.roomModels.map((roomModel) => {
    const effectiveExecutionState = resolveRoomModelExecutionState(roomModel.executionState, roomModel.cooldownUntil, now);

    if (effectiveExecutionState === roomModel.executionState) {
      return roomModel;
    }

    return {
      ...roomModel,
      executionState: effectiveExecutionState,
      cooldownUntil: effectiveExecutionState === "COOLDOWN" ? roomModel.cooldownUntil : null,
    };
  });
  const runnableRoomModels = normalizedRoomModels.filter(
    (roomModel) => roomModel.model.enabled && !isRoomModelCoolingDown(roomModel, now),
  );
  const skippedRoomModels = room.roomModels
    .filter((roomModel) => !runnableRoomModels.some((candidate) => candidate.id === roomModel.id))
    .map((roomModel) => ({
      modelId: roomModel.modelId,
      name: roomModel.model.name,
      reason: roomModel.model.enabled ? ("cooldown" as const) : ("disabled" as const),
      availableAt:
        roomModel.model.enabled && roomModel.cooldownUntil instanceof Date ? roomModel.cooldownUntil.toISOString() : null,
    }));

  return {
    runnableRoomModels,
    skippedRoomModels,
    normalizedRoomModels,
  };
}

function isTransientProviderFailure(kind: string) {
  return kind === "network" || kind === "empty_response" || kind === "reasoning_only" || kind === "request";
}

function buildPauseReason(modelName: string, error: string, providerErrorKind: string) {
  if (providerErrorKind === "quota") {
    return `Model ${modelName} was automatically paused after the provider reported quota or token exhaustion. ${error}`;
  }

  if (providerErrorKind === "authentication") {
    return `Model ${modelName} was automatically paused after the provider rejected the API key or authentication. ${error}`;
  }

  if (providerErrorKind === "not_found") {
    return `Model ${modelName} was automatically paused because the configured model ID or endpoint was not found upstream. ${error}`;
  }

  return `Model ${modelName} was automatically paused after the provider returned an unusable reply. ${error}`;
}

export interface SendRoomMessageInput {
  roomId: string;
  content: string;
}

export async function sendRoomMessage(
  input: SendRoomMessageInput,
  dependencies: SendRoomMessageDependencies = defaultDependencies,
) {
  const releaseRoomSendLock = acquireRoomSendLock(input.roomId);

  try {
    const room = assertRunnableRoom(await dependencies.getRoomById(input.roomId), input.roomId);
    const { runnableRoomModels, skippedRoomModels, normalizedRoomModels } = buildRunnableRoomSelection(room);

    if (runnableRoomModels.length === 0) {
      throw new ApiError(
        409,
        `Room ${input.roomId} does not currently have any runnable models. All models are disabled or cooling down.`,
        {
          reasonCode: "room_has_no_runnable_models",
          retryable: true,
          fieldHints: ["roomId", "modelId"],
          roomId: input.roomId,
        },
      );
    }

    const createConversationRoundWithFallback =
      dependencies.createConversationRound ??
      (async () => null);
    const markConversationRoundStepRunningWithFallback =
      dependencies.markConversationRoundStepRunning ??
      (async () => undefined);
    const markConversationRoundStepRepliedWithFallback =
      dependencies.markConversationRoundStepReplied ??
      (async () => undefined);
    const markConversationRoundStepFailedWithFallback =
      dependencies.markConversationRoundStepFailed ??
      (async () => undefined);
    const finishConversationRoundWithFallback =
      dependencies.finishConversationRound ??
      (async () => undefined);
    const markConversationRoundFailedWithFallback =
      dependencies.markConversationRoundFailed ??
      (async () => undefined);

    const userMessage = await dependencies.createUserMessage(input.roomId, input.content);
    let conversationRoundId: string | null = null;
    let conversationRoundFinalized = false;

    try {
      const runnableRoomModelIds = new Set(runnableRoomModels.map((roomModel) => roomModel.id));
      const conversationRound = await createConversationRoundWithFallback({
        roomId: input.roomId,
        userMessageId: userMessage.id,
        userMessageSequence: userMessage.sequence,
        steps: normalizedRoomModels.map((roomModel) => ({
          roomModelId: roomModel.id,
          modelId: roomModel.modelId,
          sortOrder: roomModel.sortOrder,
          status: runnableRoomModelIds.has(roomModel.id)
            ? ConversationRoundStepStatus.PENDING
            : ConversationRoundStepStatus.SKIPPED,
        })),
      });
      conversationRoundId = conversationRound?.id ?? null;

      const history = await dependencies.listMessagesByRoomId(input.roomId);
      const result = await runSequentialConversation({
        roomId: input.roomId,
        history: history.map(toHistoryMessage),
        models: runnableRoomModels.map((roomModel) => ({
          modelId: roomModel.modelId,
          sortOrder: roomModel.sortOrder,
          config: toModelRuntimeConfig(roomModel.model),
        })),
        createAdapter: dependencies.createAdapter,
        onModelStart: async ({ modelId }) => {
          const roomModel = normalizedRoomModels.find((entry) => entry.modelId === modelId);

          if (!conversationRoundId || !roomModel) {
            return;
          }

          await markConversationRoundStepRunningWithFallback(conversationRoundId, roomModel.id);
        },
        onModelReplied: async ({ modelId, message }) => {
          const roomModel = normalizedRoomModels.find((entry) => entry.modelId === modelId);

          if (!conversationRoundId || !roomModel) {
            return;
          }

          await markConversationRoundStepRepliedWithFallback(conversationRoundId, roomModel.id, message.id);
        },
        onModelFailed: async ({ modelId, error, providerErrorKind }) => {
          const roomModel = normalizedRoomModels.find((entry) => entry.modelId === modelId);
          const resolvedProviderErrorKind = providerErrorKind ?? inferProviderErrorKindFromMessage(error);

          if (!conversationRoundId || !roomModel) {
            return;
          }

          await markConversationRoundStepFailedWithFallback(conversationRoundId, roomModel.id, {
            errorKind: resolvedProviderErrorKind,
            errorMessage: error,
          });
        },
        saveAssistantMessage: async ({ roomId, modelId, content, replyDurationMs, replyTiming }) => {
          const roomModel = normalizedRoomModels.find((entry) => entry.modelId === modelId);
          const message = await dependencies.createAssistantMessage(
            roomId,
            modelId,
            content,
            replyDurationMs,
            roomModel
              ? {
                  name: roomModel.model.name,
                  provider: roomModel.model.provider,
                  modelName: roomModel.model.modelName,
                  avatarLabel: roomModel.model.avatarLabel,
                  avatarColor: roomModel.model.avatarColor,
                }
              : undefined,
            replyTiming,
          );

          try {
            await dependencies.clearRoomModelFailure(roomId, modelId);
          } catch (clearFailureError) {
            logServerEvent("warn", "room_message_failure_snapshot_clear_failed", {
              roomId,
              modelId,
              error:
                clearFailureError instanceof Error
                  ? clearFailureError.message
                  : "Unknown room model failure snapshot clear failure",
            });
          }

          return {
            id: message.id,
            roomId: message.roomId,
            role: message.role.toLowerCase() as ChatMessage["role"],
            content: message.content,
            modelId: message.modelId,
            sequence: message.sequence,
            replyDurationMs: message.replyDurationMs,
            replyTiming:
              typeof message.queueDurationMs === "number" ||
              typeof message.providerRequestDurationMs === "number" ||
              typeof message.providerAttemptCount === "number" ||
              typeof message.recoveryRequestDurationMs === "number" ||
              typeof message.rewriteRequestDurationMs === "number" ||
              typeof message.persistenceDurationMs === "number"
                ? {
                    queueDurationMs: message.queueDurationMs,
                    providerRequestDurationMs: message.providerRequestDurationMs,
                    providerAttemptCount: message.providerAttemptCount,
                    recoveryRequestDurationMs: message.recoveryRequestDurationMs,
                    rewriteRequestDurationMs: message.rewriteRequestDurationMs,
                    persistenceDurationMs: message.persistenceDurationMs,
                  }
                : null,
            speakerName: message.speakerName ?? roomModel?.model.name ?? null,
            speakerProvider: message.speakerProvider ?? roomModel?.model.provider ?? null,
            speakerModelName: message.speakerModelName ?? roomModel?.model.modelName ?? null,
          };
        },
      });

      const markRoomModelInCooldownWithFallback =
        dependencies.markRoomModelInCooldown ??
        (async (
          _roomId: string,
          _modelId: string,
          failure: {
            kind: string;
            message: string;
            occurredAt: Date;
          },
        ) => buildRoomModelCooldownUntil(failure.kind, failure.occurredAt));
      const roundOutcomes: Array<{
        modelId: string;
        modelName: string;
        outcome: "replied" | "failed";
        error?: string;
        providerErrorKind?: string;
        providerErrorDetails?: typeof result.roundOutcomes[number]["providerErrorDetails"];
        paused?: boolean;
        pauseReason?: string;
        cooldownUntil?: string;
      }> = [];

      for (const outcome of result.roundOutcomes) {
        const roomModel = normalizedRoomModels.find((entry) => entry.modelId === outcome.modelId);
        const modelName = roomModel?.model.name ?? outcome.modelId;

        if (outcome.outcome === "replied") {
          roundOutcomes.push({
            modelId: outcome.modelId,
            modelName,
            outcome: "replied",
          });
          continue;
        }

        const providerErrorKind =
          outcome.providerErrorKind ?? (outcome.error ? inferProviderErrorKindFromMessage(outcome.error) : undefined);
        let paused = false;
        let pauseReason: string | undefined;
        let cooldownUntil: string | undefined;

        if (roomModel && outcome.error && providerErrorKind) {
          const failureSnapshot = {
            kind: providerErrorKind,
            message: outcome.error,
            occurredAt: new Date(),
          };

          try {
            if (isTransientProviderFailure(providerErrorKind)) {
              const nextCooldownUntil = await markRoomModelInCooldownWithFallback(
                input.roomId,
                outcome.modelId,
                failureSnapshot,
              );
              cooldownUntil = nextCooldownUntil.toISOString();
            } else {
              await dependencies.recordRoomModelFailure(input.roomId, outcome.modelId, failureSnapshot);
            }
          } catch (recordFailureError) {
            logServerEvent("warn", "room_message_failure_snapshot_record_failed", {
              roomId: input.roomId,
              failedModelId: outcome.modelId,
              providerErrorKind,
              error:
                recordFailureError instanceof Error
                  ? recordFailureError.message
                  : "Unknown room model failure snapshot record failure",
            });
          }

          if (providerErrorKind === "network" && isProviderTimeoutLikeMessage(outcome.error)) {
            try {
              await dependencies.recordRoomModelTimeout(input.roomId, outcome.modelId);
            } catch (timeoutMetricError) {
              logServerEvent("error", "room_message_timeout_metric_failed", {
                roomId: input.roomId,
                failedModelId: outcome.modelId,
                error:
                  timeoutMetricError instanceof Error ? timeoutMetricError.message : "Unknown timeout metric failure",
              });
            }
          }

          if (shouldPauseModelOnProviderErrorKind(providerErrorKind)) {
            pauseReason = buildPauseReason(roomModel.model.name, outcome.error, providerErrorKind);

            try {
              await dependencies.pauseModel(outcome.modelId, pauseReason);
              paused = true;
            } catch (pauseError) {
              logServerEvent("error", "room_message_pause_failed", {
                roomId: input.roomId,
                failedModelId: outcome.modelId,
                providerErrorKind,
                pauseReason,
                error: pauseError instanceof Error ? pauseError.message : "Unknown pause failure",
              });
            }
          }
        }

        roundOutcomes.push({
          modelId: outcome.modelId,
          modelName,
          outcome: "failed",
          error: outcome.error,
          providerErrorKind,
          providerErrorDetails: outcome.providerErrorDetails,
          paused,
          pauseReason,
          cooldownUntil,
        });
      }

      if (conversationRoundId) {
        await finishConversationRoundWithFallback(
          conversationRoundId,
          result.status === "completed" ? ConversationRoundStatus.COMPLETED : ConversationRoundStatus.PARTIAL,
        );
        conversationRoundFinalized = true;
      }

      const firstFailedOutcome = roundOutcomes.find((outcome) => outcome.outcome === "failed");
      const firstFailureProviderErrorKind = firstFailedOutcome?.providerErrorKind;

      return {
        roomId: input.roomId,
        status: result.status,
        userMessage,
        assistantMessages: result.messages,
        roundOutcomes,
        skippedModels: skippedRoomModels,
        failedModelId: firstFailedOutcome?.modelId,
        error: firstFailedOutcome?.error,
        providerErrorKind: firstFailureProviderErrorKind,
        providerErrorDetails: firstFailedOutcome?.providerErrorDetails,
        failedModelPaused: firstFailedOutcome?.paused ?? false,
        failedModelPauseReason: firstFailedOutcome?.pauseReason,
        failedModelCooldownUntil: firstFailedOutcome?.cooldownUntil,
      };
    } catch (error) {
      if (conversationRoundId && !conversationRoundFinalized) {
        try {
          await markConversationRoundFailedWithFallback(conversationRoundId);
        } catch (roundStateError) {
          logServerEvent("error", "conversation_round_finalize_failed", {
            roomId: input.roomId,
            roundId: conversationRoundId,
            error:
              roundStateError instanceof Error
                ? roundStateError.message
                : "Unknown conversation round finalize failure",
          });
        }
      }

      throw error;
    }
  } finally {
    releaseRoomSendLock();
  }
}
