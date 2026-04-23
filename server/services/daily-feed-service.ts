import { prisma } from "@/lib/prisma";
import { listPublishedDailyIssues } from "@/server/services/daily-issue-service";
import type { BuildDailyRssFeedOptions } from "@/types/daily";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildDailyIssueUrl(baseUrl: string, slug: string) {
  return `${normalizeBaseUrl(baseUrl)}/daily/${slug}`;
}

function formatRssDate(value: string | null) {
  const date = value ? new Date(value) : new Date();
  return date.toUTCString();
}

function stripHtml(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function listRssEligibleDailyIssues(limit = 30) {
  return listPublishedDailyIssues(limit);
}

export async function getLatestDailyIssuePublishedAt() {
  const issue = await prisma.dailyIssue.findFirst({
    where: {
      status: "PUBLISHED",
      publishedAt: {
        not: null,
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    select: {
      publishedAt: true,
    },
  });

  return issue?.publishedAt ?? null;
}

export async function buildDailyRssFeed(options: BuildDailyRssFeedOptions) {
  const issues = await listRssEligibleDailyIssues(options.limit ?? 30);
  const normalizedBaseUrl = normalizeBaseUrl(options.baseUrl);
  const latestPublishedAt =
    issues.find((issue) => issue.publishedAt)?.publishedAt
      ? new Date(issues.find((issue) => issue.publishedAt)!.publishedAt!)
      : await getLatestDailyIssuePublishedAt();
  const language = options.language ?? "zh-CN";
  const channelLink = `${normalizedBaseUrl}/daily`;

  const itemsXml = issues
    .map((issue) => {
      const issueUrl = buildDailyIssueUrl(normalizedBaseUrl, issue.slug);
      const description = stripHtml(issue.summary) || issue.items?.map((item) => item.summary ?? item.title).join(" ") || issue.title;

      return [
        "  <item>",
        `    <title>${escapeXml(issue.title)}</title>`,
        `    <link>${escapeXml(issueUrl)}</link>`,
        `    <guid isPermaLink="true">${escapeXml(issueUrl)}</guid>`,
        `    <pubDate>${escapeXml(formatRssDate(issue.publishedAt))}</pubDate>`,
        `    <description>${escapeXml(description)}</description>`,
        "  </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `  <title>${escapeXml(options.siteTitle)}</title>`,
    `  <link>${escapeXml(channelLink)}</link>`,
    `  <description>${escapeXml(options.siteDescription)}</description>`,
    `  <language>${escapeXml(language)}</language>`,
    `  <lastBuildDate>${escapeXml((latestPublishedAt ?? new Date()).toUTCString())}</lastBuildDate>`,
    itemsXml,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
}
