ALTER TABLE "chat_room_models" ADD COLUMN "last_failure_kind" TEXT;
ALTER TABLE "chat_room_models" ADD COLUMN "last_failure_message" TEXT;
ALTER TABLE "chat_room_models" ADD COLUMN "last_failure_at" DATETIME;
