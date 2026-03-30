import { z } from "zod";

import { REQUEST_ID_HEADER } from "@/lib/request-id";
import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { inferProviderErrorKindFromMessage } from "@/server/http/provider-error";
import { assertMessagePostRateLimit } from "@/server/http/rate-limit";
import { parseJsonBody } from "@/server/http/request";
import { logServerEvent } from "@/server/observability/server-logger";
import { presentMessages } from "@/server/presenters/api-presenters";
import { getChatRoomById } from "@/server/services/chat-room-service";
import { listMessagesByRoomId } from "@/server/services/message-service";
import { sendRoomMessage } from "@/server/services/room-message-service";

const createMessageSchema = z.object({
  content: z.string().min(1),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const room = await getChatRoomById(id);

    if (!room) {
      return jsonWithRequestId(_request, { error: "The requested record was not found." }, { status: 404 });
    }

    const messages = await listMessagesByRoomId(id);
    return jsonWithRequestId(_request, { messages: presentMessages(messages) });
  } catch (error) {
    return handleRouteError(error, _request);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertMessagePostRateLimit(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, createMessageSchema);
    const result = await sendRoomMessage({
      roomId: id,
      content: body.content,
    });

    const response = jsonWithRequestId(request, result, {
      status: result.status === "completed" ? 201 : 207,
    });

    if (result.status === "partial") {
      const room = await getChatRoomById(id);
      const failedOutcomes = result.roundOutcomes.filter((outcome) => outcome.outcome === "failed");

      for (const failedOutcome of failedOutcomes) {
        const failedRoomModel = room?.roomModels.find((roomModel) => roomModel.modelId === failedOutcome.modelId);

        logServerEvent("warn", "room_message_partial", {
          requestId: response.headers.get(REQUEST_ID_HEADER),
          roomId: id,
          failedModelId: failedOutcome.modelId,
          failedModelName: failedOutcome.modelName ?? failedRoomModel?.model.name,
          provider: failedRoomModel?.model.provider,
          providerErrorKind:
            failedOutcome.providerErrorKind ??
            (failedOutcome.error ? inferProviderErrorKindFromMessage(failedOutcome.error) : undefined),
          providerErrorDetails: failedOutcome.providerErrorDetails,
          failedModelPaused: failedOutcome.paused ?? false,
          failedModelPauseReason: failedOutcome.pauseReason,
          error: failedOutcome.error,
        });
      }
    }

    return response;
  } catch (error) {
    return handleRouteError(error, request);
  }
}
