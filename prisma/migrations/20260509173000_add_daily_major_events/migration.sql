CREATE TABLE "daily_major_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'industry',
    "source_url" TEXT NOT NULL,
    "source_name" TEXT,
    "importance_score" INTEGER NOT NULL DEFAULT 80,
    "tags_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "daily_major_events_event_date_title_key" ON "daily_major_events"("event_date", "title");
CREATE INDEX "daily_major_events_event_date_idx" ON "daily_major_events"("event_date");
CREATE INDEX "daily_major_events_category_event_date_idx" ON "daily_major_events"("category", "event_date");
CREATE INDEX "daily_major_events_importance_score_idx" ON "daily_major_events"("importance_score");
