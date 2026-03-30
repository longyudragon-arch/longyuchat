ALTER TABLE "chat_room_models" ADD COLUMN "execution_state" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "chat_room_models" ADD COLUMN "cooldown_until" DATETIME;
ALTER TABLE "chat_room_models" ADD COLUMN "consecutive_failure_count" INTEGER NOT NULL DEFAULT 0;
