-- CreateTable
CREATE TABLE "daily_issue_item_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issue_item_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "source_name" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_issue_item_sources_issue_item_id_fkey" FOREIGN KEY ("issue_item_id") REFERENCES "daily_issue_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_issue_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issue_id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'TECH_INSIGHTS',
    "certainty" TEXT NOT NULL DEFAULT 'CONFIRMED',
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
INSERT INTO "new_daily_issue_items" ("cluster_id", "content", "created_at", "id", "is_featured", "issue_id", "sort_order", "source_name", "source_url", "summary", "tags_json", "title", "updated_at") SELECT "cluster_id", "content", "created_at", "id", "is_featured", "issue_id", "sort_order", "source_name", "source_url", "summary", "tags_json", "title", "updated_at" FROM "daily_issue_items";
DROP TABLE "daily_issue_items";
ALTER TABLE "new_daily_issue_items" RENAME TO "daily_issue_items";
CREATE INDEX "daily_issue_items_issue_id_category_sort_order_idx" ON "daily_issue_items"("issue_id", "category", "sort_order");
CREATE INDEX "daily_issue_items_is_featured_sort_order_idx" ON "daily_issue_items"("is_featured", "sort_order");
CREATE UNIQUE INDEX "daily_issue_items_issue_id_cluster_id_key" ON "daily_issue_items"("issue_id", "cluster_id");
CREATE UNIQUE INDEX "daily_issue_items_issue_id_sort_order_key" ON "daily_issue_items"("issue_id", "sort_order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "daily_issue_item_sources_source_name_idx" ON "daily_issue_item_sources"("source_name");

-- CreateIndex
CREATE UNIQUE INDEX "daily_issue_item_sources_issue_item_id_sort_order_key" ON "daily_issue_item_sources"("issue_item_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "daily_issue_item_sources_issue_item_id_url_key" ON "daily_issue_item_sources"("issue_item_id", "url");
