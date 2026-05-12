import type { DailyIssueCategory, DailyIssueItemCertainty, DailyIssueItemView, DailyIssueView } from "@/types/daily";

export const orderedDailyCategories: DailyIssueCategory[] = [
  "HEADLINES",
  "MODEL_RELEASES",
  "DEV_ECOSYSTEM",
  "PRODUCT_UPDATES",
  "TECH_INSIGHTS",
  "RUMORS",
];

export const dailyCategoryLabels: Record<DailyIssueCategory, string> = {
  HEADLINES: "要闻",
  MODEL_RELEASES: "模型发布",
  DEV_ECOSYSTEM: "开发生态",
  PRODUCT_UPDATES: "产品应用",
  TECH_INSIGHTS: "技术与洞察",
  RUMORS: "前瞻与传闻",
};

export const dailyCertaintyLabels: Record<DailyIssueItemCertainty, string> = {
  CONFIRMED: "已确认",
  WATCHLIST: "待观察",
  RUMOR: "传闻",
};

export const dailyCertaintyBadgeClassNames: Record<DailyIssueItemCertainty, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  WATCHLIST: "bg-amber-50 text-amber-700 border-amber-200/60",
  RUMOR: "bg-rose-50 text-rose-700 border-rose-200/60",
};

export const dailyMajorEventCategoryLabels: Record<string, string> = {
  model: "模型",
  product: "产品",
  developer: "开发者",
  research: "研究",
  industry: "行业",
};

export function buildDailyAnchorId(item: DailyIssueItemView) {
  return `item-${item.sortOrder}-${item.id}`;
}

export function formatDailyDate(value: string | null | undefined) {
  return value ? value.replace(/-/g, ".") : "暂无";
}

export function formatDailyYear(value: string | null | undefined) {
  return value?.slice(0, 4) ?? "未知年份";
}

export function getDailyMajorEventCategoryLabel(category: string) {
  return dailyMajorEventCategoryLabels[category] ?? "大事件";
}

export function estimateDailyReadMinutes(itemCount: number | null | undefined) {
  return Math.max(3, Math.ceil((itemCount ?? 0) * 0.72));
}

export function truncateDailyText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? "";
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export function isGenericDailyTitle(title: string, issueDate: string) {
  const normalized = title.trim();
  return normalized === `AI 日报 ${issueDate}` || normalized === `AI 日报 ${formatDailyDate(issueDate)}`;
}

export function isWeakDailySummary(summary: string | null | undefined) {
  const normalized = summary?.trim() ?? "";
  if (!normalized) {
    return true;
  }

  const asciiCharacters = Array.from(normalized).filter((char) => char.charCodeAt(0) <= 127).length;
  return asciiCharacters / normalized.length >= 0.45;
}

export function getDailyIssueDek(issue: Pick<DailyIssueView, "summary" | "itemCount">) {
  if (!isWeakDailySummary(issue.summary)) {
    return issue.summary ?? "";
  }

  return `本期收录 ${issue.itemCount} 条 AI 变化，覆盖模型、产品、开发生态和行业信号。`;
}

export function groupDailyItemsByCategory(items: DailyIssueItemView[]) {
  const groups = new Map<DailyIssueCategory, DailyIssueItemView[]>();

  for (const category of orderedDailyCategories) {
    groups.set(category, []);
  }

  for (const item of items) {
    groups.get(item.category)?.push(item);
  }

  return orderedDailyCategories
    .map((category) => ({
      category,
      label: dailyCategoryLabels[category],
      items: groups.get(category) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}

export function buildDailyHeroCopy(issue: DailyIssueView) {
  const items = issue.items ?? [];
  const featuredItems = items.filter((item) => item.isFeatured);
  const leadItems = (featuredItems.length > 0 ? featuredItems : items).slice(0, 3);
  const displayTitle =
    !isGenericDailyTitle(issue.title, issue.issueDate) && !isWeakDailySummary(issue.title)
      ? issue.title
      : leadItems.length >= 2
        ? `AI 日报：${leadItems[0]?.title}`
        : leadItems.length === 1
          ? `AI 日报：${leadItems[0]?.title}`
          : `AI 日报 ${formatDailyDate(issue.issueDate)}`;
  const displaySummary =
    !isWeakDailySummary(issue.summary)
      ? issue.summary ?? "这期日报由 LongyuChat 自动生成与发布。"
      : leadItems.length > 0
        ? `今日聚焦：${leadItems.map((item) => truncateDailyText(item.summary ?? item.title, 24)).join("；")}`
        : getDailyIssueDek(issue);
  const heroTags = Array.from(
    new Set(
      leadItems.flatMap((item) => [
        dailyCategoryLabels[item.category],
        item.sourceName ?? null,
      ].filter((value): value is string => Boolean(value))),
    ),
  ).slice(0, 4);

  return {
    displayTitle,
    displaySummary,
    heroTags,
    leadItems,
  };
}

export function getDailySourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
