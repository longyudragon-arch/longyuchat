ALTER TABLE "messages" ADD COLUMN "provider_request_duration_ms" INTEGER;
ALTER TABLE "messages" ADD COLUMN "provider_attempt_count" INTEGER;
ALTER TABLE "messages" ADD COLUMN "recovery_request_duration_ms" INTEGER;
ALTER TABLE "messages" ADD COLUMN "rewrite_request_duration_ms" INTEGER;
