import type { ConversationRoundEventView, RoomRoundEventStreamView, RoomStreamSnapshotView, RoomView } from "@/types/app";
import { handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { presentRoom } from "@/server/presenters/api-presenters";
import { getChatRoomById } from "@/server/services/chat-room-service";
import { listConversationRoundEventsSince } from "@/server/services/conversation-round-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function toRoomStreamSnapshot(room: ReturnType<typeof presentRoom>) {
  return JSON.parse(JSON.stringify(room)) as RoomView;
}

function createRoomSnapshotSignature(room: RoomView) {
  return JSON.stringify(room);
}

function encodeRoomSnapshot(encoder: TextEncoder, payload: RoomStreamSnapshotView) {
  return encoder.encode(`event: room-snapshot\ndata: ${JSON.stringify(payload)}\n\n`);
}

function toConversationRoundEventView(event: Awaited<ReturnType<typeof listConversationRoundEventsSince>>[number]) {
  return {
    streamIndex: event.streamIndex,
    roomId: event.roomId,
    roundId: event.roundId,
    stepId: event.stepId,
    roomModelId: event.roomModelId,
    modelId: event.modelId,
    eventType: event.eventType,
    roundStatus: event.roundStatus,
    stepStatus: event.stepStatus,
    messageId: event.messageId,
    errorKind: event.errorKind as ConversationRoundEventView["errorKind"],
    errorMessage: event.errorMessage,
    occurredAt: event.occurredAt.toISOString(),
  } satisfies ConversationRoundEventView;
}

function encodeRoundEvent(encoder: TextEncoder, payload: RoomRoundEventStreamView) {
  return encoder.encode(
    `id: ${payload.event.streamIndex}\nevent: round-event\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

function encodeKeepAlive(encoder: TextEncoder) {
  return encoder.encode(`: keepalive ${Date.now()}\n\n`);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const initialRoomRecord = await getChatRoomById(id);

    if (!initialRoomRecord) {
      return jsonWithRequestId(request, { error: "The requested record was not found." }, { status: 404 });
    }

    const encoder = new TextEncoder();
    const initialRoom = toRoomStreamSnapshot(presentRoom(initialRoomRecord));
    let closeStream = () => {};
    const requestedLastEventId = Number.parseInt(request.headers.get("last-event-id") ?? "0", 10);
    const initialLastEventId = Number.isFinite(requestedLastEventId) ? requestedLastEventId : 0;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let pollInFlight = false;
        let lastSignature = createRoomSnapshotSignature(initialRoom);
        let lastEventId = initialLastEventId;
        let pollIntervalId: ReturnType<typeof setInterval> | null = null;
        let keepAliveIntervalId: ReturnType<typeof setInterval> | null = null;

        closeStream = () => {
          if (closed) {
            return;
          }

          closed = true;

          if (pollIntervalId) {
            clearInterval(pollIntervalId);
          }

          if (keepAliveIntervalId) {
            clearInterval(keepAliveIntervalId);
          }

          try {
            controller.close();
          } catch {
            // 客户端提前断开时，ReadableStream 可能已经关闭，这里直接忽略即可。
          }
        };

        const enqueueSnapshot = (room: RoomView) => {
          controller.enqueue(
            encodeRoomSnapshot(encoder, {
              room,
              emittedAt: new Date().toISOString(),
            }),
          );
        };

        const emitLatestRoundEvents = async () => {
          if (closed || pollInFlight) {
            return;
          }

          pollInFlight = true;

          try {
            const nextEvents = await listConversationRoundEventsSince(id, lastEventId);

            for (const nextEvent of nextEvents) {
              lastEventId = nextEvent.streamIndex;
              controller.enqueue(
                encodeRoundEvent(encoder, {
                  event: toConversationRoundEventView(nextEvent),
                  emittedAt: new Date().toISOString(),
                }),
              );
            }

            const nextRoomRecord = await getChatRoomById(id);

            if (!nextRoomRecord) {
              closeStream();
              return;
            }

            const nextRoom = toRoomStreamSnapshot(presentRoom(nextRoomRecord));
            const nextSignature = createRoomSnapshotSignature(nextRoom);

            if (nextSignature !== lastSignature) {
              lastSignature = nextSignature;
              enqueueSnapshot(nextRoom);
            }
          } catch {
            closeStream();
          } finally {
            pollInFlight = false;
          }
        };

        enqueueSnapshot(initialRoom);
        controller.enqueue(encoder.encode("retry: 1500\n\n"));

        pollIntervalId = setInterval(() => {
          void emitLatestRoundEvents();
        }, 700);

        keepAliveIntervalId = setInterval(() => {
          if (!closed) {
            controller.enqueue(encodeKeepAlive(encoder));
          }
        }, 15000);

        request.signal.addEventListener("abort", closeStream, { once: true });
      },
      cancel() {
        closeStream();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
