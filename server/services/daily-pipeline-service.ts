import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/http/api-error";

import { prisma } from "@/lib/prisma";
import {
  buildDailyRssFeed,
} from "@/server/services/daily-feed-service";
import { generateAiDailyJson } from "@/server/services/daily-ai-service";
import {
  getAiDailyCandidateLimit,
  getAiDailyFeedBaseUrl,
  getAiDailyHeuristicScoreThreshold,
  getAiDailyMinimumItemCount,
  getAiDailyPublishItemLimit,
  getAiDailyPublishWindowHours,
  getAiDailyTimezone,
} from "@/server/services/daily-config-service";
import {
  replaceDailyStoryClusterItems,
  upsertDailyStoryCluster,
} from "@/server/services/daily-cluster-service";
import {
  getDailyIssueByDate,
  listPublishedDailyIssues,
  replaceAndPublishDailyIssue,
  skipUnpublishedDailyIssue,
} from "@/server/services/daily-issue-service";
import { getActiveDailyInterestProfile } from "@/server/services/daily-interest-service";
import {
  createDailyRunStep,
  finishDailyRunFailure,
  finishDailyRunSuccess,
  markDailyRunStepFailed,
  markDailyRunStepRunning,
  markDailyRunStepSuccess,
  startDailyRun,
} from "@/server/services/daily-run-service";
import {
  listEnabledDailySourcesForWorker,
  upsertDailySourceItem,
} from "@/server/services/daily-source-service";
import { fetchDailySourceItems } from "@/server/services/daily-fetch-service";
import type {
  DailyIssueCategory,
  DailyIssueItemCertainty,
  DailyPublishResult,
  DailyScanResult,
  DailySourceRuntimeConfig,
} from "@/types/daily";

const dailyDraftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().max(5000),
  items: z.array(z.object({
    clusterId: z.string().min(1),
    category: z.enum(["HEADLINES", "MODEL_RELEASES", "DEV_ECOSYSTEM", "PRODUCT_UPDATES", "TECH_INSIGHTS", "RUMORS"]).optional(),
    certainty: z.enum(["CONFIRMED", "WATCHLIST", "RUMOR"]).optional(),
    title: z.string().trim().min(1).max(500),
    summary: z.string().max(5000).optional(),
    content: z.string().trim().min(1).max(20000),
    isFeatured: z.boolean().optional(),
    sourceLinks: z.array(z.object({
      url: z.string().url().regex(/^https?:\/\//),
      label: z.string().optional(), sourceName: z.string().nullable().optional(),
      sortOrder: z.number().int().positive(),
    })).max(30).optional(),
  })).min(1).max(100),
});

function normalizeUrlForCluster(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? "";
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function isMostlyAscii(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  const asciiCharacters = Array.from(normalized).filter((char) => char.charCodeAt(0) <= 127).length;
  return asciiCharacters / normalized.length >= 0.75;
}

function buildClusterKey(input: {
  canonicalUrl: string;
  title: string;
}) {
  const canonical = normalizeUrlForCluster(input.canonicalUrl);
  if (canonical) {
    return createHash("sha1").update(canonical).digest("hex");
  }

  return createHash("sha1").update(slugify(input.title)).digest("hex");
}

function calculateHeuristicScore(input: {
  sourceKind: DailySourceRuntimeConfig["kind"];
  title: string;
  contentText?: string | null;
  publishedAt?: Date | null;
}) {
  const haystack = `${input.title}\n${input.contentText ?? ""}`.toLowerCase();
  let score = 4;

  if (input.sourceKind === "AIHOT") score += 2.4;
  if (input.sourceKind === "GITHUB_RELEASES") score += 1.5;
  if (input.sourceKind === "HACKERNEWS") score += 1.2;
  if (input.sourceKind === "RSS") score += 0.8;
  if (input.sourceKind === "REDDIT") score += 0.5;

  const hotKeywords = [
    "openai",
    "anthropic",
    "gemini",
    "grok",
    "deepseek",
    "qwen",
    "llm",
    "agent",
    "reasoning",
    "release",
    "model",
    "benchmark",
    "inference",
    "copilot",
    "mcp",
    "大模型",
    "发布",
    "开源",
    "上线",
  ];

  for (const keyword of hotKeywords) {
    if (haystack.includes(keyword)) {
      score += 0.6;
    }
  }

  if (input.publishedAt) {
    const ageHours = Math.max(0, (Date.now() - input.publishedAt.getTime()) / 1000 / 3600);
    if (ageHours <= 12) score += 1;
    else if (ageHours <= 24) score += 0.5;
  }

  return Number(score.toFixed(1));
}

function normalizeKeywordList(rawJson: string | null | undefined) {
  if (!rawJson?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean);
    }
  } catch {
    return rawJson
      .split(/[\n,]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function buildInterestFilterContext(input: {
  title: string;
  contentText?: string | null;
  includeKeywords: string[];
  excludeKeywords: string[];
}) {
  const haystack = `${input.title}\n${input.contentText ?? ""}`.toLowerCase();
  const matchedIncludeKeywords = input.includeKeywords.filter((keyword) => haystack.includes(keyword));
  const matchedExcludeKeywords = input.excludeKeywords.filter((keyword) => haystack.includes(keyword));

  return {
    matchedIncludeKeywords,
    matchedExcludeKeywords,
  };
}

function buildFallbackIssueDate(issueDate = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getAiDailyTimezone(),
  }).format(issueDate);
}

function parseTimeZoneOffsetToMinutes(offsetText: string) {
  const normalized = offsetText.replace("GMT", "").trim();

  if (!normalized) {
    return 0;
  }

  const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) {
    return 0;
  }

  const [, sign, hoursText, minutesText] = match;
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText ?? "0", 10);
  const total = hours * 60 + minutes;
  return sign === "-" ? -total : total;
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const offsetText = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return parseTimeZoneOffsetToMinutes(offsetText);
}

function buildTimeZoneDateWindow(issueDate: string, timeZone: string) {
  const [yearText, monthText, dayText] = issueDate.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const baseUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, baseUtc);
  const startUtc = new Date(baseUtc.getTime() - offsetMinutes * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    startUtc,
    endUtc,
  };
}

export async function runDailyScan(): Promise<DailyScanResult> {
  const run = await startDailyRun({
    runType: "SCAN",
    summary: "AI daily scan started.",
  });

  let successfulSourceCount = 0;
  let failedSourceCount = 0;
  let fetchedSourceCount = 0;
  let fetchedItemCount = 0;
  let upsertedItemCount = 0;
  let affectedClusterCount = 0;

  try {
    const sources = await listEnabledDailySourcesForWorker();
    const activeInterestProfile = await getActiveDailyInterestProfile();
    const includeKeywords = normalizeKeywordList(activeInterestProfile?.includeKeywordsJson);
    const excludeKeywords = normalizeKeywordList(activeInterestProfile?.excludeKeywordsJson);

    if (sources.length === 0) throw new ApiError(400, "No enabled daily sources are configured.");

    for (const source of sources) {
      const step = await createDailyRunStep({
        runId: run.id,
        stepName: `scan:${source.name}`,
      });

      try {
        await markDailyRunStepRunning(step.id, `Fetching ${source.kind} source ${source.name}`);
        const fetchedItems = await fetchDailySourceItems(source);
        fetchedSourceCount += 1;
        fetchedItemCount += fetchedItems.length;

        for (const fetchedItem of fetchedItems) {
          const item = await upsertDailySourceItem(fetchedItem);
          upsertedItemCount += 1;

          const clusterKey = buildClusterKey({
            canonicalUrl: item.canonicalUrl,
            title: item.title,
          });
          const heuristicScore = calculateHeuristicScore({
            sourceKind: source.kind,
            title: item.title,
            contentText: item.contentText,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          });
          const interestFilter = buildInterestFilterContext({
            title: item.title,
            contentText: item.contentText,
            includeKeywords,
            excludeKeywords,
          });
          const scoreBoost = interestFilter.matchedIncludeKeywords.length * 1.1;
          const shouldRejectByExcludeKeyword = interestFilter.matchedExcludeKeywords.length > 0;
          const cluster = await upsertDailyStoryCluster({
            clusterKey,
            canonicalUrl: item.canonicalUrl,
            primarySourceItemId: item.id,
            title: item.title,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            score: Number((heuristicScore + scoreBoost).toFixed(1)),
            status: shouldRejectByExcludeKeyword
              ? "REJECTED"
              : heuristicScore + scoreBoost >= getAiDailyHeuristicScoreThreshold()
                ? "SELECTED"
                : "PENDING",
            summaryDraft: truncateText(item.summaryRaw ?? item.contentText ?? item.title, 280),
            editorialReason: shouldRejectByExcludeKeyword
              ? `Filtered by exclude keywords: ${interestFilter.matchedExcludeKeywords.join(", ")}`
              : interestFilter.matchedIncludeKeywords.length > 0
                ? `Boosted by include keywords: ${interestFilter.matchedIncludeKeywords.join(", ")}`
                : null,
          });

          affectedClusterCount += 1;

          const existingLinks = await prisma.dailyStoryClusterItem.findMany({
            where: {
              clusterId: cluster.id,
            },
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              sourceItemId: true,
              isPrimary: true,
              sortOrder: true,
            },
          });

          const alreadyLinked = existingLinks.some((link) => link.sourceItemId === item.id);
          if (!alreadyLinked) {
            await replaceDailyStoryClusterItems({
              clusterId: cluster.id,
              items: [
                ...existingLinks.map((link) => ({
                  sourceItemId: link.sourceItemId,
                  isPrimary: link.isPrimary,
                  sortOrder: link.sortOrder,
                })),
                {
                  sourceItemId: item.id,
                  isPrimary: existingLinks.length === 0,
                  sortOrder: existingLinks.length + 1,
                },
              ],
            });
          }
        }

        await markDailyRunStepSuccess(step.id, `Fetched ${fetchedItems.length} items from ${source.name}`);
        successfulSourceCount += 1;
      } catch (error) {
        failedSourceCount += 1;
        await markDailyRunStepFailed(
          step.id,
          error instanceof Error ? error.message : `Failed to scan source ${source.name}`,
        );
      }
    }

    const result: DailyScanResult = {
      runId: run.id,
      outcome: failedSourceCount > 0 ? "PARTIAL" : "SUCCESS",
      successfulSourceCount, failedSourceCount, fetchedSourceCount,
      fetchedItemCount, upsertedItemCount, affectedClusterCount,
    };
    if (failedSourceCount > 0) {
      if (successfulSourceCount === 0) throw new ApiError(502, "All daily sources failed. Check the run steps.");
      await finishDailyRunFailure(run.id, `${failedSourceCount} sources failed.`, {
        summary: `Partial scan: ${successfulSourceCount} succeeded, ${failedSourceCount} failed.`,
        statsJson: JSON.stringify(result),
      });
    } else {
      await finishDailyRunSuccess(run.id, {
        summary: `AI daily scan completed. ${fetchedItemCount} items processed.`,
        statsJson: JSON.stringify(result),
      });
    }
    return result;
  } catch (error) {
    await finishDailyRunFailure(run.id, error instanceof Error ? error.message : "AI daily scan failed.", {
      statsJson: JSON.stringify({ successfulSourceCount, failedSourceCount, fetchedSourceCount, fetchedItemCount, upsertedItemCount, affectedClusterCount }),
    });
    throw error;
  }
}

interface PublishClusterCandidate {
  id: string;
  title: string;
  canonicalUrl: string;
  publishedAt: string | null;
  score: number | null;
  summaryDraft: string | null;
  sourceName: string | null;
  sourceCategory: string | null;
  sourceKind: DailySourceRuntimeConfig["kind"] | null;
  sourceLinks: Array<{
    url: string;
    label: string;
    sourceName: string | null;
    sortOrder: number;
  }>;
}

const categoryDescriptions: Record<DailyIssueCategory, string> = {
  HEADLINES: "要闻 / 最值得关注的重磅消息",
  MODEL_RELEASES: "模型发布 / 新模型、权重、API 或评测发布",
  DEV_ECOSYSTEM: "开发生态 / 编程工具、开源项目、开发者平台、网关、工作流",
  PRODUCT_UPDATES: "产品应用 / AI 产品、桌面应用、工作区、客户端更新",
  TECH_INSIGHTS: "技术与洞察 / 研究、性能优化、实现经验、深度分析",
  RUMORS: "前瞻与传闻 / 未完全证实的消息、内测、邀测、市场传闻",
};

function inferIssueCategory(input: {
  title: string;
  sourceName: string | null;
  sourceCategory?: string | null;
  sourceKind: DailySourceRuntimeConfig["kind"] | null;
}): DailyIssueCategory {
  const haystack = `${input.title}\n${input.sourceName ?? ""}`.toLowerCase();

  if (input.sourceCategory === "ai-models") return "MODEL_RELEASES";
  if (input.sourceCategory === "ai-products") return "PRODUCT_UPDATES";
  if (input.sourceCategory === "paper") return "TECH_INSIGHTS";
  if (input.sourceCategory === "tip") return "DEV_ECOSYSTEM";
  if (input.sourceCategory === "industry") return "HEADLINES";

  if (/\brumou?r\b|传闻|消息称|内测|邀测|preview|即将|will|watchlist/.test(haystack)) {
    return "RUMORS";
  }

  if (
    input.sourceKind === "GITHUB_RELEASES" ||
    /\brelease\b|发布|开源|open-source|open-sourced|模型|weights|checkpoint|api/.test(haystack)
  ) {
    return "MODEL_RELEASES";
  }

  if (/\bcursor\b|codex|gateway|tool|sdk|开发|开源 ai 编程|openclaw|cline|roo code|vercel ai/.test(haystack)) {
    return "DEV_ECOSYSTEM";
  }

  if (/desktop|webui|workspace|product|应用|客户端|工作区|产品/.test(haystack)) {
    return "PRODUCT_UPDATES";
  }

  if (input.sourceKind === "HACKERNEWS" || /benchmark|kernel|research|论文|训练|推理|技术|insight|性能/.test(haystack)) {
    return "TECH_INSIGHTS";
  }

  return "HEADLINES";
}

function inferIssueCertainty(category: DailyIssueCategory, title: string): DailyIssueItemCertainty {
  if (/传闻|rumou?r|消息称|unauthorized|内测|邀测|即将|融资|估值|raising|valuation/i.test(title)) {
    return category === "RUMORS" ? "RUMOR" : "WATCHLIST";
  }

  if (category === "RUMORS") {
    return /传闻|rumou?r|消息称|unauthorized|内测|邀测|即将/.test(title.toLowerCase()) ? "RUMOR" : "WATCHLIST";
  }

  return "CONFIRMED";
}

function formatCategoryLabel(category: DailyIssueCategory) {
  return `${category}：${categoryDescriptions[category]}`;
}

function hasChineseText(value: string | null | undefined) {
  return /[\u4e00-\u9fff]/.test(value ?? "");
}

function isWeakCandidateTitle(title: string) {
  const normalized = title.trim();

  if (!normalized) {
    return true;
  }

  if (normalized.length < 8 && !hasChineseText(normalized)) {
    return true;
  }

  return /^v?\d+(?:\.\d+){1,4}(?:[-+][\w.]+)?$/i.test(normalized);
}

function scorePublishCandidateQuality(candidate: PublishClusterCandidate, index: number) {
  const category = inferIssueCategory({
    title: candidate.title,
    sourceName: candidate.sourceName,
    sourceCategory: candidate.sourceCategory,
    sourceKind: candidate.sourceKind,
  });
  let score = candidate.score ?? 0;

  if (candidate.sourceKind === "AIHOT") score += 4;
  if (candidate.sourceCategory) score += 1.5;
  if (hasChineseText(candidate.title)) score += 1;
  if (hasChineseText(candidate.summaryDraft)) score += 0.6;
  if (candidate.summaryDraft && candidate.summaryDraft.trim().length >= 40) score += 0.8;
  if (candidate.sourceLinks.length > 1) score += 0.6;
  if (category === "HEADLINES") score += 0.5;
  if (isWeakCandidateTitle(candidate.title)) score -= 5;

  return score - index * 0.01;
}

function curatePublishCandidates(candidates: PublishClusterCandidate[], limit: number) {
  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      category: inferIssueCategory({
        title: candidate.title,
        sourceName: candidate.sourceName,
        sourceCategory: candidate.sourceCategory,
        sourceKind: candidate.sourceKind,
      }),
      qualityScore: scorePublishCandidateQuality(candidate, index),
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore);

  const selected: PublishClusterCandidate[] = [];
  const categoryCounts = new Map<DailyIssueCategory, number>();

  for (const entry of ranked) {
    if (selected.length >= limit) {
      break;
    }

    const categoryCount = categoryCounts.get(entry.category) ?? 0;
    if (categoryCount >= 2 && selected.length < Math.max(3, Math.floor(limit * 0.75))) {
      continue;
    }

    selected.push(entry.candidate);
    categoryCounts.set(entry.category, categoryCount + 1);
  }

  for (const entry of ranked) {
    if (selected.length >= limit) {
      break;
    }

    if (!selected.some((candidate) => candidate.id === entry.candidate.id)) {
      selected.push(entry.candidate);
    }
  }

  return selected;
}

function getSourceItemDisplayName(item: {
  source: {
    name: string;
  };
  metaJson: string | null;
}) {
  if (item.metaJson?.trim()) {
    try {
      const parsed = JSON.parse(item.metaJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const sourceName = (parsed as { sourceName?: unknown }).sourceName;
        if (typeof sourceName === "string" && sourceName.trim()) {
          return sourceName.trim();
        }
      }
    } catch {
      // Fall back to the configured source name when metadata is not valid JSON.
    }
  }

  return item.source.name;
}

function getSourceItemCategory(item: {
  metaJson: string | null;
}) {
  if (!item.metaJson?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(item.metaJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const category = (parsed as { category?: unknown }).category;
      return typeof category === "string" && category.trim() ? category.trim() : null;
    }
  } catch {
    return null;
  }

  return null;
}

function buildIssueSelectionPrompt(candidates: PublishClusterCandidate[], itemLimit: number) {
  return [
    "你是 LongyuChat 的 AI 日报编辑。",
    "请从候选事件中挑选最值得放进日报的条目，并输出严格 JSON。",
    "请优先遵循稳定日报结构：先概览，再逐条正文，条目应尽量覆盖不同栏目。",
    "除非条目中的词语本身是品牌名、模型名、项目名或技术术语，否则 title、summary、content 默认必须使用简体中文。",
    "允许保留如 DeepSeek、Kimi K2.6、GoModel、RTX 5080 这类专有名词原文，但叙述句必须是中文。",
    `最多选择 ${itemLimit} 条。`,
    "可选栏目：",
    ...Object.keys(categoryDescriptions).map((category) =>
      `- ${formatCategoryLabel(category as DailyIssueCategory)}`,
    ),
    "可信度 certainty 只能是：CONFIRMED / WATCHLIST / RUMOR。",
    "JSON 格式：",
    '{',
    '  "title": "日报标题",',
    '  "summary": "日报导语",',
    '  "items": [',
    '    {',
    '      "clusterId": "候选 cluster id",',
    '      "category": "HEADLINES",',
    '      "certainty": "CONFIRMED",',
    '      "title": "条目标题",',
    '      "summary": "一句话摘要",',
    '      "content": "完整条目正文，2-4 句",',
    '      "isFeatured": true,',
    '      "sourceLinks": [',
    '        { "url": "来源链接", "label": "显示名称", "sourceName": "来源名", "sortOrder": 1 }',
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    "候选事件如下：",
    JSON.stringify(candidates, null, 2),
  ].join("\n");
}

function buildChineseLocalizationPrompt(draft: {
  title: string;
  summary: string;
  items: Array<{
    clusterId: string;
    category?: DailyIssueCategory;
    certainty?: DailyIssueItemCertainty;
    title: string;
    summary?: string;
    content: string;
    isFeatured?: boolean;
    sourceLinks?: Array<{
      url: string;
      label?: string;
      sourceName?: string | null;
      sortOrder: number;
    }>;
  }>;
}) {
  return [
    "请把下面这份 AI 日报 JSON 改写为适合中文读者阅读的版本，并返回严格 JSON。",
    "要求：",
    "1. title、summary、content 默认必须使用简体中文。",
    "2. 品牌名、模型名、项目名、技术术语可以保留英文原文。",
    "3. 不要改 clusterId、category、certainty、isFeatured、sourceLinks。",
    "4. 不要输出解释，不要输出 markdown，只返回 JSON。",
    "",
    JSON.stringify(draft, null, 2),
  ].join("\n");
}

function buildFallbackIssue(issueDate: string, candidates: PublishClusterCandidate[], itemLimit: number) {
  const selected = candidates.slice(0, itemLimit);
  const leadTitle = selected[0]?.title ? truncateText(selected[0].title, 34) : issueDate;
  return {
    title: selected.length > 0 ? `AI 日报：${leadTitle}` : `AI 日报 ${issueDate}`,
    summary: selected.length > 0
      ? `今日精选 ${selected.length} 条 AI 变化，重点关注${selected.slice(0, 3).map((item) => item.title).join("、")}。`
      : "今日暂无值得发布的高质量条目。",
    items: selected.map((item, index) => ({
      clusterId: item.id,
      category: inferIssueCategory({
        title: item.title,
        sourceName: item.sourceName,
        sourceCategory: item.sourceCategory,
        sourceKind: item.sourceKind,
      }),
      certainty: inferIssueCertainty(
        inferIssueCategory({
          title: item.title,
          sourceName: item.sourceName,
          sourceCategory: item.sourceCategory,
          sourceKind: item.sourceKind,
        }),
        item.title,
      ),
      title: hasChineseText(item.title) ? item.title : `关注：${item.title}`,
      summary: truncateText(item.summaryDraft ?? item.title, 88),
      content:
        truncateText(item.summaryDraft ?? item.title, 220) ||
        `${item.title}。详情请查看原始来源。`,
      isFeatured: index === 0,
      sourceLinks: item.sourceLinks,
    })),
  };
}

function shouldRelocalizeDraftToChinese(draft: {
  title: string;
  summary: string;
  items: Array<{
    title: string;
    content: string;
  }>;
}) {
  let englishLikeCount = 0;

  if (isMostlyAscii(draft.title)) {
    englishLikeCount += 1;
  }

  if (isMostlyAscii(draft.summary)) {
    englishLikeCount += 1;
  }

  for (const item of draft.items) {
    if (isMostlyAscii(item.title)) {
      englishLikeCount += 1;
    }
    if (isMostlyAscii(item.content)) {
      englishLikeCount += 1;
    }
  }

  return englishLikeCount >= 3;
}

function buildInterestPromptAppendix(interestsText: string | null | undefined, includeKeywords: string[], excludeKeywords: string[]) {
  return [
    "筛选偏好：",
    interestsText?.trim() ? `- 兴趣描述：${interestsText.trim()}` : "- 兴趣描述：无",
    includeKeywords.length > 0 ? `- 优先关键词：${includeKeywords.join("、")}` : "- 优先关键词：无",
    excludeKeywords.length > 0 ? `- 排除关键词：${excludeKeywords.join("、")}` : "- 排除关键词：无",
  ].join("\n");
}

export async function runDailyPublish(input?: { issueDate?: string }): Promise<DailyPublishResult> {
  const issueDate = input?.issueDate ?? buildFallbackIssueDate();
  const run = await startDailyRun({
    runType: "PUBLISH",
    summary: `AI daily publish started for ${issueDate}.`,
  });

  try {
    const hours = getAiDailyPublishWindowHours();
    const itemLimit = getAiDailyPublishItemLimit();
    const minimumItemCount = getAiDailyMinimumItemCount();
    const candidateLimit = getAiDailyCandidateLimit();
    const timezone = getAiDailyTimezone();
    const currentLocalIssueDate = buildFallbackIssueDate();
    const hasExplicitIssueDate = Boolean(input?.issueDate);
    const useRollingWindow = !hasExplicitIssueDate || issueDate === currentLocalIssueDate;
    const now = new Date();
    const { startUtc, endUtc } = buildTimeZoneDateWindow(issueDate, timezone);
    const windowEnd = useRollingWindow ? now : endUtc;
    const windowStart = useRollingWindow ? new Date(now.getTime() - hours * 3600 * 1000) : startUtc;

    const candidatesRaw = await prisma.dailyStoryCluster.findMany({
      where: {
        publishedAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        status: {
          in: ["SELECTED", "PENDING"],
        },
      },
      orderBy: [{ score: "desc" }, { publishedAt: "desc" }],
      take: Math.max(candidateLimit * 4, 30),
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
          include: {
            sourceItem: {
              include: {
                source: true,
              },
            },
          },
        },
      },
    });

    const rawCandidates: PublishClusterCandidate[] = candidatesRaw.map((cluster) => ({
      id: cluster.id,
      title: cluster.title,
      canonicalUrl: cluster.canonicalUrl,
      publishedAt: cluster.publishedAt?.toISOString() ?? null,
      score: cluster.score ?? null,
      summaryDraft: cluster.summaryDraft,
      sourceName: cluster.items[0] ? getSourceItemDisplayName(cluster.items[0].sourceItem) : null,
      sourceCategory: cluster.items[0] ? getSourceItemCategory(cluster.items[0].sourceItem) : null,
      sourceKind: cluster.items[0]?.sourceItem.source.kind ?? null,
      sourceLinks: cluster.items
        .map((item, index) => ({
          url: item.sourceItem.canonicalUrl,
          label: getSourceItemDisplayName(item.sourceItem) ?? `来源 ${index + 1}`,
          sourceName: getSourceItemDisplayName(item.sourceItem) ?? null,
          sortOrder: index + 1,
        }))
        .filter((sourceLink, index, sourceLinks) =>
          sourceLinks.findIndex((candidate) => candidate.url === sourceLink.url) === index,
        ),
    }));
    const candidates = curatePublishCandidates(rawCandidates, candidateLimit);
    const activeInterestProfile = await getActiveDailyInterestProfile();
    const includeKeywords = normalizeKeywordList(activeInterestProfile?.includeKeywordsJson);
    const excludeKeywords = normalizeKeywordList(activeInterestProfile?.excludeKeywordsJson);

    const existingIssue = await getDailyIssueByDate(issueDate);

    if (candidates.length < minimumItemCount) {
      const skippedIssue = await skipUnpublishedDailyIssue({
        issueDate, slug: `daily-${issueDate}`, title: `AI 日报 ${issueDate}`,
        summary: "今天没有达到自动发布阈值的足够条目。",
        sourceWindowStart: windowStart, sourceWindowEnd: windowEnd,
        metaJson: JSON.stringify({ reason: "insufficient_candidates" }),
      });
      const preserved = skippedIssue.status === "PUBLISHED";
      await finishDailyRunSuccess(run.id, {
        summary: preserved ? `Existing publication preserved for ${issueDate}.` : `AI daily publish skipped for ${issueDate}.`,
        statsJson: JSON.stringify({
          issueId: skippedIssue.id,
          selectedClusterCount: 0,
          publishedItemCount: 0,
        }),
      });

      return {
        runId: run.id,
        issueId: skippedIssue.id,
        issueDate,
        status: skippedIssue.status,
        outcome: preserved ? "PRESERVED" : "SKIPPED",
        selectedClusterCount: 0,
        publishedItemCount: preserved ? skippedIssue.itemCount : 0,
      };
    }

    let aiDraft: {
      title: string;
      summary: string;
      items: Array<{
        clusterId: string;
        category?: DailyIssueCategory;
        certainty?: DailyIssueItemCertainty;
        title: string;
        summary?: string;
        content: string;
        isFeatured?: boolean;
        sourceLinks?: Array<{
          url: string;
          label?: string;
          sourceName?: string | null;
          sortOrder: number;
        }>;
      }>;
    } | null = null;

    try {
      aiDraft = await generateAiDailyJson({
        schema: dailyDraftSchema,
        system:
          "你是 LongyuChat 的 AI 日报编辑。请只返回合法 JSON，不要输出额外解释。",
        user: [
          buildIssueSelectionPrompt(candidates, itemLimit),
          "",
          buildInterestPromptAppendix(activeInterestProfile?.interestsText, includeKeywords, excludeKeywords),
        ].join("\n"),
        defaultReplyLength: 3800,
      });
    } catch (error) {
      if (existingIssue?.status === "PUBLISHED") throw error;
      aiDraft = null;
    }

    const hasUsableAiDraft = Boolean(aiDraft && Array.isArray(aiDraft.items) && aiDraft.items.length > 0);
    if (!hasUsableAiDraft && existingIssue?.status === "PUBLISHED") {
      throw new ApiError(502, "No usable AI draft was generated; the existing publication was preserved.");
    }
    let draft = hasUsableAiDraft
      ? aiDraft!
      : buildFallbackIssue(issueDate, candidates, itemLimit);

    if (hasUsableAiDraft && shouldRelocalizeDraftToChinese(draft)) {
      try {
        const relocalizedDraft = await generateAiDailyJson({
          schema: dailyDraftSchema,
          system: "你是 LongyuChat 的中文日报润色编辑。请只返回合法 JSON。",
          user: buildChineseLocalizationPrompt(draft),
          defaultReplyLength: 4200,
        });

        if (relocalizedDraft && Array.isArray(relocalizedDraft.items) && relocalizedDraft.items.length > 0) {
          draft = relocalizedDraft;
        }
      } catch (error) {
        if (existingIssue?.status === "PUBLISHED") throw error;
        // Keep the first draft when localization retry fails.
      }
    }

    const selectedItems = draft.items
      .filter((item, index, items) => candidates.some((candidate) => candidate.id === item.clusterId) && items.findIndex((other) => other.clusterId === item.clusterId) === index)
      .slice(0, itemLimit);

    if (selectedItems.length < minimumItemCount) {
      throw new ApiError(502, "The generated issue has too few valid items; the existing publication was preserved.");
    }
    const publishedIssue = await replaceAndPublishDailyIssue({
      issueDate, slug: `daily-${issueDate}`,
      title: draft.title.trim() || `AI 日报 ${issueDate}`,
      summary: draft.summary.trim() || null,
      sourceWindowStart: windowStart, sourceWindowEnd: windowEnd,
      items: selectedItems.map((item, index) => {
        const cluster = candidates.find((candidate) => candidate.id === item.clusterId)!;
        const fallbackCategory = inferIssueCategory({
          title: item.title?.trim() || cluster.title,
          sourceName: cluster.sourceName,
          sourceCategory: cluster.sourceCategory,
          sourceKind: cluster.sourceKind,
        });
        return {
          clusterId: item.clusterId,
          category: item.category ?? fallbackCategory,
          certainty: item.certainty ?? inferIssueCertainty(fallbackCategory, item.title?.trim() || cluster.title),
          title: item.title?.trim() || cluster.title,
          summary: item.summary?.trim() || truncateText(cluster.summaryDraft ?? cluster.title, 88),
          content: item.content?.trim() || truncateText(cluster.summaryDraft ?? cluster.title, 220),
          sourceUrl: cluster.canonicalUrl,
          sourceName: cluster.sourceName,
          tagsJson: null,
          sortOrder: index + 1,
          isFeatured: item.isFeatured ?? index === 0,
          sourceLinks: cluster.sourceLinks,
        };
      }),
    });


    await finishDailyRunSuccess(run.id, {
      summary: `AI daily publish completed for ${issueDate}.`,
      statsJson: JSON.stringify({
        issueId: publishedIssue.id,
        selectedClusterCount: selectedItems.length,
        publishedItemCount: selectedItems.length,
      }),
    });

    return {
      runId: run.id,
      issueId: publishedIssue.id,
      issueDate,
      status: "PUBLISHED",
      outcome: "PUBLISHED",
      selectedClusterCount: selectedItems.length,
      publishedItemCount: selectedItems.length,
    };
  } catch (error) {
    await finishDailyRunFailure(run.id, error instanceof Error ? error.message : "AI daily publish failed.");
    throw error;
  }
}

export async function buildDailyRssXml(baseUrlOverride?: string | null) {
  const issues = await listPublishedDailyIssues(30);
  const baseUrl = baseUrlOverride ?? getAiDailyFeedBaseUrl() ?? "http://localhost:3000";

  return buildDailyRssFeed({
    baseUrl,
    siteTitle: "LongyuChat AI 日报",
    siteDescription: "LongyuChat 自动生成的 AI 日报。",
    limit: issues.length || 30,
    language: "zh-CN",
  });
}
