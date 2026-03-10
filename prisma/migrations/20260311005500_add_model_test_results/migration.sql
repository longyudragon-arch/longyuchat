ALTER TABLE "model_configs"
ADD COLUMN "last_test_status" TEXT;

ALTER TABLE "model_configs"
ADD COLUMN "last_test_message" TEXT;

ALTER TABLE "model_configs"
ADD COLUMN "last_tested_at" DATETIME;
