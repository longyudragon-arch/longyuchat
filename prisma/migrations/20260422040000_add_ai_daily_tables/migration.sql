-- CreateTable
CREATE TABLE "daily_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "base_url" TEXT,
    "feed_url" TEXT,
    "config_json" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "last_fetched_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_source_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "source_item_key" TEXT NOT NULL,
    "external_id" TEXT,
    "canonical_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "published_at" DATETIME,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT,
    "content_text" TEXT,
    "content_html" TEXT,
    "summary_raw" TEXT,
    "meta_json" TEXT,
    "content_hash" TEXT,
    CONSTRAINT "daily_source_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "daily_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_story_clusters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cluster_key" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "primary_source_item_id" TEXT,
    "title" TEXT NOT NULL,
    "published_at" DATETIME,
    "score" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tags_json" TEXT,
    "summary_draft" TEXT,
    "editorial_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "daily_story_clusters_primary_source_item_id_fkey" FOREIGN KEY ("primary_source_item_id") REFERENCES "daily_source_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_story_cluster_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cluster_id" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_story_cluster_items_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "daily_story_clusters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "daily_story_cluster_items_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "daily_source_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issue_date" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "cover_image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" DATETIME,
    "source_window_start" DATETIME,
    "source_window_end" DATETIME,
    "meta_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_issue_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issue_id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_name" TEXT,
    "tags_json" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "daily_issue_items_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "daily_issues" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "daily_issue_items_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "daily_story_clusters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "summary" TEXT,
    "error_message" TEXT,
    "stats_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_run_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_id" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" DATETIME,
    "finished_at" DATETIME,
    "message" TEXT,
    "payload_json" TEXT,
    CONSTRAINT "daily_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "daily_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_sources_name_key" ON "daily_sources"("name");

-- CreateIndex
CREATE INDEX "daily_sources_enabled_priority_idx" ON "daily_sources"("enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "daily_source_items_source_item_key_key" ON "daily_source_items"("source_item_key");

-- CreateIndex
CREATE INDEX "daily_source_items_source_id_published_at_idx" ON "daily_source_items"("source_id", "published_at");

-- CreateIndex
CREATE INDEX "daily_source_items_canonical_url_idx" ON "daily_source_items"("canonical_url");

-- CreateIndex
CREATE INDEX "daily_source_items_content_hash_idx" ON "daily_source_items"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "daily_story_clusters_cluster_key_key" ON "daily_story_clusters"("cluster_key");

-- CreateIndex
CREATE INDEX "daily_story_clusters_status_published_at_idx" ON "daily_story_clusters"("status", "published_at");

-- CreateIndex
CREATE INDEX "daily_story_clusters_score_idx" ON "daily_story_clusters"("score");

-- CreateIndex
CREATE INDEX "daily_story_cluster_items_source_item_id_idx" ON "daily_story_cluster_items"("source_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_story_cluster_items_cluster_id_source_item_id_key" ON "daily_story_cluster_items"("cluster_id", "source_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_story_cluster_items_cluster_id_sort_order_key" ON "daily_story_cluster_items"("cluster_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "daily_issues_issue_date_key" ON "daily_issues"("issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_issues_slug_key" ON "daily_issues"("slug");

-- CreateIndex
CREATE INDEX "daily_issues_status_published_at_idx" ON "daily_issues"("status", "published_at");

-- CreateIndex
CREATE INDEX "daily_issue_items_is_featured_sort_order_idx" ON "daily_issue_items"("is_featured", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "daily_issue_items_issue_id_cluster_id_key" ON "daily_issue_items"("issue_id", "cluster_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_issue_items_issue_id_sort_order_key" ON "daily_issue_items"("issue_id", "sort_order");

-- CreateIndex
CREATE INDEX "daily_runs_run_type_started_at_idx" ON "daily_runs"("run_type", "started_at");

-- CreateIndex
CREATE INDEX "daily_runs_status_started_at_idx" ON "daily_runs"("status", "started_at");

-- CreateIndex
CREATE INDEX "daily_run_steps_run_id_started_at_idx" ON "daily_run_steps"("run_id", "started_at");
