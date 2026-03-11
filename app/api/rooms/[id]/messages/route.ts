import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { assertMessagePostRateLimit } from "@/server/http/rate-limit";
import { parseJsonBody } from "@/server/http/request";
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

    return jsonWithRequestId(request, result, {
      status: result.status === "completed" ? 201 : 207,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
