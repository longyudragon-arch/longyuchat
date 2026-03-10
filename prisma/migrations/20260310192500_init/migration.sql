-- CreateTable
CREATE TABLE "model_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chat_room_models" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "room_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    CONSTRAINT "chat_room_models_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_room_models_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_configs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "room_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "model_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_configs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "model_configs_name_key" ON "model_configs"("name");

-- CreateIndex
CREATE INDEX "chat_room_models_model_id_idx" ON "chat_room_models"("model_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_models_room_id_model_id_key" ON "chat_room_models"("room_id", "model_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_models_room_id_sort_order_key" ON "chat_room_models"("room_id", "sort_order");

-- CreateIndex
CREATE INDEX "messages_room_id_created_at_idx" ON "messages"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_model_id_idx" ON "messages"("model_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_room_id_sequence_key" ON "messages"("room_id", "sequence");
