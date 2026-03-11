import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { emptyWithRequestId, jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentRoom } from "@/server/presenters/api-presenters";
import { deleteChatRoom, getChatRoomById, updateChatRoom } from "@/server/services/chat-room-service";

const updateRoomSchema = z.object({
  title: z.string().min(1).optional(),
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

    return jsonWithRequestId(_request, { room: presentRoom(room) });
  } catch (error) {
    return handleRouteError(error, _request);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateRoomSchema);
    const room = await updateChatRoom(id, body);

    return jsonWithRequestId(request, { room: presentRoom(room) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteChatRoom(id);

    return emptyWithRequestId(_request, { status: 204 });
  } catch (error) {
    return handleRouteError(error, _request);
  }
}
