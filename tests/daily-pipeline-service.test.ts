import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clusters: vi.fn(), links: vi.fn(), fetch: vi.fn(), sources: vi.fn(), upsertItem: vi.fn(),
  upsertCluster: vi.fn(), replaceLinks: vi.fn(), interest: vi.fn(), generate: vi.fn(),
  existingIssue: vi.fn(), publish: vi.fn(), skip: vi.fn(),
  start: vi.fn(), step: vi.fn(), running: vi.fn(), stepSuccess: vi.fn(), stepFailure: vi.fn(),
  success: vi.fn(), failure: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  dailyStoryCluster: { findMany: mocks.clusters }, dailyStoryClusterItem: { findMany: mocks.links },
} }));
vi.mock("@/server/services/daily-ai-service", () => ({ generateAiDailyJson: mocks.generate }));
vi.mock("@/server/services/daily-config-service", () => ({
  getAiDailyCandidateLimit: () => 10, getAiDailyFeedBaseUrl: () => null,
  getAiDailyHeuristicScoreThreshold: () => 5, getAiDailyMinimumItemCount: () => 2,
  getAiDailyPublishItemLimit: () => 5, getAiDailyPublishWindowHours: () => 24,
  getAiDailyTimezone: () => "Asia/Shanghai",
}));
vi.mock("@/server/services/daily-cluster-service", () => ({
  replaceDailyStoryClusterItems: mocks.replaceLinks, upsertDailyStoryCluster: mocks.upsertCluster,
}));
vi.mock("@/server/services/daily-issue-service", () => ({
  getDailyIssueByDate: mocks.existingIssue, listPublishedDailyIssues: vi.fn(),
  replaceAndPublishDailyIssue: mocks.publish, skipUnpublishedDailyIssue: mocks.skip,
}));
vi.mock("@/server/services/daily-interest-service", () => ({ getActiveDailyInterestProfile: mocks.interest }));
vi.mock("@/server/services/daily-run-service", () => ({
  startDailyRun: mocks.start, createDailyRunStep: mocks.step, markDailyRunStepRunning: mocks.running,
  markDailyRunStepSuccess: mocks.stepSuccess, markDailyRunStepFailed: mocks.stepFailure,
  finishDailyRunSuccess: mocks.success, finishDailyRunFailure: mocks.failure,
}));
vi.mock("@/server/services/daily-source-service", () => ({
  listEnabledDailySourcesForWorker: mocks.sources, upsertDailySourceItem: mocks.upsertItem,
}));
vi.mock("@/server/services/daily-fetch-service", () => ({ fetchDailySourceItems: mocks.fetch }));

import { runDailyPublish, runDailyScan } from "@/server/services/daily-pipeline-service";

function candidate(id: string) {
  return {
    id, title: `人工智能模型发布更新 ${id}`, canonicalUrl: `https://example.com/${id}`,
    publishedAt: new Date(), score: 10, summaryDraft: "模型正式发布，带来多项性能改进。",
    items: [{ sourceItem: {
      canonicalUrl: `https://example.com/${id}`, metaJson: null,
      source: { name: "官方发布", kind: "RSS" },
    } }],
  };
}

function draft(ids = ["one", "two"]) {
  return { title: "今日人工智能日报", summary: "两条值得关注的模型更新。", items: ids.map((clusterId) => ({
    clusterId, title: "新的人工智能模型发布", content: "新的模型正式发布，性能有所提升。",
    sourceLinks: [{ url: "https://invented.example.com", sortOrder: 1 }],
  })) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.start.mockResolvedValue({ id: "run-1" });
  mocks.step.mockResolvedValue({ id: "step-1" });
  mocks.sources.mockResolvedValue([{ id: "a", name: "A", kind: "RSS" }, { id: "b", name: "B", kind: "RSS" }]);
  mocks.fetch.mockResolvedValue([]);
  mocks.interest.mockResolvedValue(null);
  mocks.existingIssue.mockResolvedValue(null);
  mocks.clusters.mockResolvedValue([candidate("one"), candidate("two")]);
  mocks.generate.mockResolvedValue(draft());
  mocks.publish.mockResolvedValue({ id: "issue-1", status: "PUBLISHED", itemCount: 2 });
});

describe("daily scan outcomes", () => {
  it("fails the run and caller when every source fails, retaining failure counts", async () => {
    mocks.fetch.mockRejectedValue(new Error("upstream unavailable"));
    await expect(runDailyScan()).rejects.toMatchObject({ status: 502 });
    expect(mocks.stepFailure).toHaveBeenCalledTimes(2);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.failure).toHaveBeenCalledOnce();
    expect(JSON.parse(mocks.failure.mock.calls[0][2].statsJson)).toMatchObject({ failedSourceCount: 2, successfulSourceCount: 0 });
  });

  it("reports partial progress and never records SUCCESS when one source fails", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("one source unavailable"));
    const result = await runDailyScan();
    expect(result).toMatchObject({ outcome: "PARTIAL", failedSourceCount: 1, successfulSourceCount: 1 });
    expect(mocks.failure).toHaveBeenCalledOnce();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.stepSuccess).toHaveBeenCalledOnce();
  });

  it("counts persistence failures as failed sources even when fetch succeeds", async () => {
    mocks.fetch.mockResolvedValue([{ title: "synthetic article" }]);
    mocks.upsertItem.mockRejectedValue(new Error("database write failed"));
    await expect(runDailyScan()).rejects.toMatchObject({ status: 502 });
    expect(JSON.parse(mocks.failure.mock.calls[0][2].statsJson)).toMatchObject({ fetchedSourceCount: 2, failedSourceCount: 2, successfulSourceCount: 0 });
  });
});

describe("safe daily publication", () => {
  it("preserves a published issue when candidates are insufficient", async () => {
    mocks.clusters.mockResolvedValue([]);
    mocks.skip.mockResolvedValue({ id: "issue-1", status: "PUBLISHED", itemCount: 3 });
    const result = await runDailyPublish({ issueDate: "2026-09-20" });
    expect(result).toMatchObject({ status: "PUBLISHED", outcome: "PRESERVED", publishedItemCount: 3 });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each(["error", "missing"])("preserves existing content when AI is %s", async (mode) => {
    mocks.existingIssue.mockResolvedValue({ id: "issue-1", status: "PUBLISHED" });
    if (mode === "error") mocks.generate.mockRejectedValue(new Error("provider unavailable"));
    else mocks.generate.mockResolvedValue(null);
    await expect(runDailyPublish()).rejects.toThrow();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.failure).toHaveBeenCalledOnce();
  });

  it("preserves publication on localization failure", async () => {
    mocks.existingIssue.mockResolvedValue({ id: "issue-1", status: "PUBLISHED" });
    mocks.generate.mockResolvedValueOnce({ ...draft(), title: "Daily AI news", summary: "Today's new model releases", items: draft().items.map((item) => ({ ...item, title: "A new model release" })) });
    mocks.generate.mockRejectedValueOnce(new Error("localization unavailable"));
    await expect(runDailyPublish()).rejects.toThrow("localization unavailable");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each([["unknown", "missing"], ["one", "one"]])("rejects too few valid unique candidates: %j", async (...ids) => {
    mocks.generate.mockResolvedValue(draft(ids));
    await expect(runDailyPublish()).rejects.toMatchObject({ status: 502 });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("publishes once with source links taken from fetched candidates", async () => {
    await expect(runDailyPublish()).resolves.toMatchObject({ status: "PUBLISHED", outcome: "PUBLISHED", publishedItemCount: 2 });
    expect(mocks.publish).toHaveBeenCalledOnce();
    expect(mocks.publish.mock.calls[0][0].items[0].sourceLinks).toEqual([
      { url: "https://example.com/one", label: "官方发布", sourceName: "官方发布", sortOrder: 1 },
    ]);
  });

  it("retains heuristic publication for a new issue without an AI model", async () => {
    mocks.generate.mockResolvedValue(null);
    await expect(runDailyPublish()).resolves.toMatchObject({ status: "PUBLISHED", publishedItemCount: 2 });
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it("reports a failed publication when the atomic write fails", async () => {
    mocks.publish.mockRejectedValue(new Error("write failed"));
    await expect(runDailyPublish()).rejects.toThrow("write failed");
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.failure).toHaveBeenCalledOnce();
  });
});
