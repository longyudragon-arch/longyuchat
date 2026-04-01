CREATE TABLE "conversation_round_events" (
    "stream_index" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "room_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "step_id" TEXT,
    "room_model_id" TEXT,
    "model_id" TEXT,
    "event_type" TEXT NOT NULL,
    "round_status" TEXT,
    "step_status" TEXT,
    "message_id" TEXT,
    "error_kind" TEXT,
    "error_message" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_round_events_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_round_events_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "conversation_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversation_round_events_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "conversation_round_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "conversation_round_events_room_id_stream_index_idx" ON "conversation_round_events"("room_id", "stream_index");
CREATE INDEX "conversation_round_events_round_id_occurred_at_idx" ON "conversation_round_events"("round_id", "occurred_at");
