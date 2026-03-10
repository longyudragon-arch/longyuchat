import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/http/api-error";
import { parseJsonBody } from "@/server/http/request";
import { presentRoom, presentRoomList } from "@/server/presenters/api-presenters";
import { createChatRoom, listChatRooms } from "@/server/services/chat-room-service";

const createRoomSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["SINGLE", "GROUP"]),
  modelIds: z.array(z.string().min(1)).min(1),
});

export async function GET() {
  try {
    const rooms = await listChatRooms();
    return NextResponse.json({ rooms: presentRoomList(rooms) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, createRoomSchema);
    const room = await createChatRoom(body);

    return NextResponse.json(
      { room: presentRoom(room) },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

