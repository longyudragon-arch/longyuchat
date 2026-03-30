ALTER TABLE "messages" ADD COLUMN "speaker_name" TEXT;
ALTER TABLE "messages" ADD COLUMN "speaker_provider" TEXT;
ALTER TABLE "messages" ADD COLUMN "speaker_model_name" TEXT;
ALTER TABLE "messages" ADD COLUMN "speaker_avatar_label" TEXT;
ALTER TABLE "messages" ADD COLUMN "speaker_avatar_color" TEXT;

UPDATE "messages"
SET
  "speaker_name" = (
    SELECT "name"
    FROM "model_configs"
    WHERE "model_configs"."id" = "messages"."model_id"
  ),
  "speaker_provider" = (
    SELECT "provider"
    FROM "model_configs"
    WHERE "model_configs"."id" = "messages"."model_id"
  ),
  "speaker_model_name" = (
    SELECT "model_name"
    FROM "model_configs"
    WHERE "model_configs"."id" = "messages"."model_id"
  ),
  "speaker_avatar_label" = (
    SELECT "avatar_label"
    FROM "model_configs"
    WHERE "model_configs"."id" = "messages"."model_id"
  ),
  "speaker_avatar_color" = (
    SELECT "avatar_color"
    FROM "model_configs"
    WHERE "model_configs"."id" = "messages"."model_id"
  )
WHERE "role" = 'ASSISTANT'
  AND "model_id" IS NOT NULL;
