import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentRoom } from "@/server/presenters/api-presenters";
import { reorderChatRoomModels } from "@/server/services/chat-room-service";

const reorderSchema = z.object({
  modelIds: z.array(z.string().min(1)).min(1),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, reorderSchema);
    const room = await reorderChatRoomModels(id, body.modelIds);

    return jsonWithRequestId(request, { room: presentRoom(room) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
