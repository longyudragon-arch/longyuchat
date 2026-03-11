import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { parseJsonBody } from "@/server/http/request";
import { presentRoom } from "@/server/presenters/api-presenters";
import { reconfigureChatRoom } from "@/server/services/chat-room-service";

const reconfigureRoomSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["SINGLE", "GROUP"]),
  modelIds: z.array(z.string().min(1)).min(1),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await parseJsonBody(request, reconfigureRoomSchema);
    const room = await reconfigureChatRoom(id, body);

    return jsonWithRequestId(request, { room: presentRoom(room) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
