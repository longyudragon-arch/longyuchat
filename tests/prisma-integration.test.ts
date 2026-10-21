import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

describe("production SQLite integration", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "longyuchat-prisma-"));
  let prisma: typeof import("@/lib/prisma").prisma;

  beforeAll(async () => {
    const databasePath = path.join(directory, "integration.db");
    const db = new Database(databasePath);
    for (const migration of readdirSync("prisma/migrations").sort()) {
      if (!/^\d/.test(migration)) continue;
      db.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
    }
    db.close();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "file:" + databasePath.replaceAll("\\", "/"));
    vi.resetModules();
    prisma = (await import("@/lib/prisma")).prisma;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  it("retains client delegates and commits an interactive transaction", async () => {
    expect(prisma.modelConfig).toBe(prisma.modelConfig);
    const result = await prisma.$transaction(async (tx) => {
      return tx.modelConfig.create({
        data: {
          id: "integration-model", name: "Integration only", provider: "OPENAI_COMPATIBLE",
          baseUrl: "https://example.com/v1", modelName: "fixture", apiKey: "synthetic-not-used",
        },
      });
    });
    expect(result.id).toBe("integration-model");
  });

  it("rolls back the entire transaction when its operation fails", async () => {
    await expect(prisma.$transaction(async (tx) => {
      await tx.chatRoom.create({ data: { id: "rollback-room", title: "Rollback", type: "SINGLE" } });
      throw new Error("fixture rollback");
    })).rejects.toThrow("fixture rollback");
    expect(await prisma.chatRoom.count({ where: { id: "rollback-room" } })).toBe(0);
  });

  it("creates a room and persists distinct ordered messages using real service transactions", async () => {
    const { createChatRoom } = await import("@/server/services/chat-room-service");
    const { createUserMessage, listMessagesByRoomId } = await import("@/server/services/message-service");
    const room = await createChatRoom({ title: "Integration room", type: "SINGLE", modelIds: ["integration-model"] });
    await createUserMessage(room.id, "First persisted message");
    await createUserMessage(room.id, "Second persisted message");
    const history = await listMessagesByRoomId(room.id);
    expect(history.map((message) => message.sequence)).toEqual([1, 2]);
    expect(history.map((message) => message.content)).toEqual(["First persisted message", "Second persisted message"]);
  });
  it("atomically preserves published title, items and sources when replacement fails", async () => {
    const { replaceAndPublishDailyIssue, getDailyIssueByDate, skipUnpublishedDailyIssue } = await import("@/server/services/daily-issue-service");
    await prisma.dailyStoryCluster.create({ data: {
      id: "atomic-cluster", clusterKey: "atomic", title: "Atomic fixture", canonicalUrl: "https://example.com/atomic",
    } });
    const original = {
      issueDate: "2026-09-20", slug: "atomic-issue", title: "Original publication", summary: "Original summary",
      items: [{ clusterId: "atomic-cluster", title: "Original item", content: "Original content", sourceUrl: "https://example.com/atomic", sortOrder: 1 }],
    };
    await replaceAndPublishDailyIssue(original);
    await expect(replaceAndPublishDailyIssue({ ...original, title: "Must roll back", items: [{ ...original.items[0], content: "" }] })).rejects.toThrow();
    const preserved = await getDailyIssueByDate(original.issueDate);
    expect(preserved).toMatchObject({ title: original.title, summary: original.summary, status: "PUBLISHED", itemCount: 1 });
    expect(preserved?.items?.[0]).toMatchObject({ title: "Original item", content: "Original content" });
    expect(preserved?.items?.[0].sourceLinks).toHaveLength(1);
    const skipped = await skipUnpublishedDailyIssue({ ...original, title: "Must not replace" });
    expect(skipped).toMatchObject({ title: original.title, status: "PUBLISHED", itemCount: 1 });
  });

  it("persists skipped steps and a terminal event after a model failure", async () => {
    const { createChatRoom } = await import("@/server/services/chat-room-service");
    const { createUserMessage } = await import("@/server/services/message-service");
    const { createConversationRound, markConversationRoundStepFailed, finishConversationRound } = await import("@/server/services/conversation-round-service");
    await prisma.modelConfig.create({ data: {
      id: "integration-later-model", name: "Later model", provider: "OPENAI_COMPATIBLE",
      baseUrl: "https://example.com/v1", modelName: "fixture", apiKey: "synthetic-not-used",
    } });
    const room = await createChatRoom({ title: "Partial round", type: "GROUP", modelIds: ["integration-model", "integration-later-model"] });
    const message = await createUserMessage(room.id, "Persist this failed round");
    const roomModels = await prisma.chatRoomModel.findMany({ where: { roomId: room.id }, orderBy: { sortOrder: "asc" } });
    const round = await createConversationRound({
      roomId: room.id, userMessageId: message.id, userMessageSequence: message.sequence,
      steps: roomModels.map((model) => ({ roomModelId: model.id, modelId: model.modelId, sortOrder: model.sortOrder, status: "PENDING" })),
    });
    await markConversationRoundStepFailed(round.id, roomModels[0].id, { errorKind: "provider_error", errorMessage: "Synthetic failure" });
    await finishConversationRound(round.id, "PARTIAL");
    const restored = await prisma.conversationRound.findUniqueOrThrow({
      where: { id: round.id }, include: { steps: { orderBy: { sortOrder: "asc" } }, events: true },
    });
    expect(restored.status).toBe("PARTIAL");
    expect(restored.steps.map((step) => step.status)).toEqual(["FAILED", "SKIPPED"]);
    expect(restored.steps[1].errorKind).toBe("previous_failure");
    expect(restored.steps.every((step) => step.finishedAt !== null)).toBe(true);
    expect(restored.events.some((event) => event.eventType === "ROUND_PARTIAL")).toBe(true);
  });

});
