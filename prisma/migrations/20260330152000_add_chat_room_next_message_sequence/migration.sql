ALTER TABLE "chat_rooms" ADD COLUMN "next_message_sequence" INTEGER NOT NULL DEFAULT 1;

UPDATE "chat_rooms"
SET "next_message_sequence" = COALESCE(
  (
    SELECT MAX("messages"."sequence") + 1
    FROM "messages"
    WHERE "messages"."room_id" = "chat_rooms"."id"
  ),
  1
);
