import { beforeEach, describe, expect, it, vi } from "vitest";

const listPublishedDailyIssues = vi.fn();
const getLatestDailyIssuePublishedAt = vi.fn();

vi.mock("@/server/services/daily-issue-service", () => ({
  listPublishedDailyIssues,
}));

describe("buildDailyRssFeed", () => {
  beforeEach(() => {
    listPublishedDailyIssues.mockReset();
    getLatestDailyIssuePublishedAt.mockReset();
  });

  it("renders a valid RSS xml payload from published issues", async () => {
    listPublishedDailyIssues.mockResolvedValue([
      {
        id: "issue-1",
        issueDate: "2026-04-22",
        slug: "daily-2026-04-22",
        title: "AI 日报 2026-04-22",
        summary: "今天 AI 圈值得关注的 3 条变化。",
        coverImageUrl: null,
        status: "PUBLISHED",
        publishedAt: "2026-04-22T00:00:00.000Z",
        sourceWindowStart: null,
        sourceWindowEnd: null,
        metaJson: null,
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
        itemCount: 3,
        items: [
          {
            id: "item-1",
            issueId: "issue-1",
            clusterId: "cluster-1",
            title: "OpenAI 发布新更新",
            summary: "发布了新更新。",
            content: "完整内容",
            sourceUrl: "https://example.com/openai",
            sourceName: "OpenAI News",
            tagsJson: null,
            sortOrder: 1,
            isFeatured: true,
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-22T00:00:00.000Z",
          },
        ],
      },
    ]);

    const { buildDailyRssFeed } = await import("@/server/services/daily-feed-service");
    const xml = await buildDailyRssFeed({
      baseUrl: "https://longyuchat.example.com",
      siteTitle: "LongyuChat AI 日报",
      siteDescription: "自动生成的 AI 日报",
    });

    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("<title>LongyuChat AI 日报</title>");
    expect(xml).toContain("https://longyuchat.example.com/daily/daily-2026-04-22");
    expect(xml).toContain("今天 AI 圈值得关注的 3 条变化。");
  });
});
