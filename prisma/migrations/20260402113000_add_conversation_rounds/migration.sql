CREATE TABLE "conversation_rounds" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "room_id" TEXT NOT NULL,
  "user_message_id" TEXT NOT NULL,
  "user_message_sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" DATETIME,
  CONSTRAINT "conversation_rounds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_rounds_user_message_id_fkey" FOREIGN KEY ("user_message_id") REFERENCES "messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "conversation_rounds_user_message_id_key" ON "conversation_rounds"("user_message_id");
CREATE INDEX "conversation_rounds_room_id_started_at_idx" ON "conversation_rounds"("room_id", "started_at");

CREATE TABLE "conversation_round_steps" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "round_id" TEXT NOT NULL,
  "room_model_id" TEXT NOT NULL,
  "model_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error_kind" TEXT,
  "error_message" TEXT,
  "started_at" DATETIME,
  "finished_at" DATETIME,
  "message_id" TEXT,
  CONSTRAINT "conversation_round_steps_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "conversation_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_round_steps_room_model_id_fkey" FOREIGN KEY ("room_model_id") REFERENCES "chat_room_models" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_round_steps_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_configs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "conversation_round_steps_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "conversation_round_steps_message_id_key" ON "conversation_round_steps"("message_id");
CREATE UNIQUE INDEX "conversation_round_steps_round_id_room_model_id_key" ON "conversation_round_steps"("round_id", "room_model_id");
CREATE UNIQUE INDEX "conversation_round_steps_round_id_sort_order_key" ON "conversation_round_steps"("round_id", "sort_order");
CREATE INDEX "conversation_round_steps_model_id_idx" ON "conversation_round_steps"("model_id");
