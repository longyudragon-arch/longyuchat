import Link from "next/link";
import { notFound } from "next/navigation";

import { getDailyIssueBySlug } from "@/server/services/daily-issue-service";
import type { DailyIssueCategory, DailyIssueItemCertainty, DailyIssueItemView, DailyIssueView } from "@/types/daily";

export const dynamic = "force-dynamic";

const orderedCategories: DailyIssueCategory[] = [
  "HEADLINES",
  "MODEL_RELEASES",
  "DEV_ECOSYSTEM",
  "PRODUCT_UPDATES",
  "TECH_INSIGHTS",
  "RUMORS",
];

const categoryLabels: Record<DailyIssueCategory, string> = {
  HEADLINES: "要闻",
  MODEL_RELEASES: "模型发布",
  DEV_ECOSYSTEM: "开发生态",
  PRODUCT_UPDATES: "产品应用",
  TECH_INSIGHTS: "技术与洞察",
  RUMORS: "前瞻与传闻",
};

const certaintyLabels: Record<DailyIssueItemCertainty, string> = {
  CONFIRMED: "已确认",
  WATCHLIST: "待观察",
  RUMOR: "传闻",
};

const certaintyBadgeClassNames: Record<DailyIssueItemCertainty, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  WATCHLIST: "bg-amber-50 text-amber-700 border-amber-200/60",
  RUMOR: "bg-rose-50 text-rose-700 border-rose-200/60",
};

function buildAnchorId(item: DailyIssueItemView) {
  return `item-${item.sortOrder}-${item.id}`;
}

function groupItemsByCategory(items: DailyIssueItemView[]) {
  const groups = new Map<DailyIssueCategory, DailyIssueItemView[]>();

  for (const category of orderedCategories) {
    groups.set(category, []);
  }

  for (const item of items) {
    groups.get(item.category)?.push(item);
  }

  return orderedCategories
    .map((category) => ({
      category,
      label: categoryLabels[category],
      items: groups.get(category) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}

function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? "";
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function isGenericIssueTitle(title: string, issueDate: string) {
  const normalized = title.trim();
  return normalized === `AI 日报 ${issueDate}` || normalized === `AI 日报 ${issueDate.replace(/-/g, ".")}`;
}

function isWeakIssueSummary(summary: string | null | undefined) {
  const normalized = summary?.trim() ?? "";
  if (!normalized) {
    return true;
  }

  const asciiCharacters = Array.from(normalized).filter((char) => char.charCodeAt(0) <= 127).length;
  return asciiCharacters / normalized.length >= 0.45;
}

function buildHeroCopy(issue: DailyIssueView) {
  const items = issue.items ?? [];
  const featuredItems = items.filter((item) => item.isFeatured);
  const leadItems = (featuredItems.length > 0 ? featuredItems : items).slice(0, 3);
  const displayTitle =
    !isGenericIssueTitle(issue.title, issue.issueDate) && !isWeakIssueSummary(issue.title)
      ? issue.title
      : leadItems.length >= 2
        ? `AI 日报：${truncateText(leadItems[0]?.title, 20)}，${truncateText(leadItems[1]?.title, 20)}`
        : leadItems.length === 1
          ? `AI 日报：${truncateText(leadItems[0]?.title, 28)}`
          : `AI 日报 ${issue.issueDate}`;
  const displaySummary =
    !isWeakIssueSummary(issue.summary)
      ? issue.summary ?? "这期日报由 LongyuChat 自动生成与发布。"
      : leadItems.length > 0
        ? `今日聚焦：${leadItems.map((item) => truncateText(item.summary ?? item.title, 24)).join("；")}`
        : "这期日报由 LongyuChat 自动生成与发布。";
  const heroTags = Array.from(
    new Set(
      leadItems.flatMap((item) => [
        categoryLabels[item.category],
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

export default async function DailyIssueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = await getDailyIssueBySlug(slug);

  if (!issue || issue.status !== "PUBLISHED") {
    notFound();
  }

  const groups = groupItemsByCategory(issue.items ?? []);
  const hero = buildHeroCopy(issue);

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.9rem] px-5 py-6 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[45%] opacity-70">
            <div className="h-full w-full bg-gradient-to-bl from-[#FF8DA1]/40 via-[#f4b6d8]/25 to-transparent blur-[90px]" />
          </div>
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium text-stone-500">
              <Link href="/daily" className="text-[#DC75A5] hover:underline">
                AI 日报
              </Link>
              <span>·</span>
              <span>{issue.issueDate}</span>
              <span>·</span>
              <span>{issue.itemCount} 条</span>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-start">
              <div className="space-y-4">
                <h1 className="max-w-4xl text-[1.9rem] font-display font-bold tracking-[-0.04em] text-[#2f2e33] sm:text-[2.35rem] lg:text-[2.7rem]">
                  {hero.displayTitle}
                </h1>
                <p className="max-w-4xl text-[15px] leading-8 text-stone-600 sm:text-[1rem]">
                  {hero.displaySummary}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {hero.heroTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#DC75A5]/15 bg-white/55 px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#DC75A5]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-white/35 p-4 backdrop-blur-xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">本期焦点</p>
                <div className="mt-3 grid gap-3">
                  {hero.leadItems.map((item, index) => (
                    <a
                      key={item.id}
                      href={`#${buildAnchorId(item)}`}
                      className="rounded-[1.1rem] bg-white/60 px-4 py-3 transition hover:bg-white"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">0{index + 1}</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-[#2f2e33]">{item.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ly-surface-card rounded-[1.5rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-display font-bold tracking-tight text-[#2f2e33]">概览</h2>
            <span className="text-[12px] font-medium text-stone-500">按栏目浏览</span>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {groups.map((group) => (
              <div key={group.category} className="rounded-[1.35rem] bg-white/40 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">{group.label}</p>
                <div className="mt-3 grid gap-2">
                  {group.items.map((item) => (
                    <a
                      key={item.id}
                      href={`#${buildAnchorId(item)}`}
                      className="text-sm font-medium leading-6 text-stone-700 transition hover:text-[#DC75A5]"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          {groups.map((group) => (
            <section key={group.category} className="space-y-4">
              <div className="flex items-center gap-3 px-2 text-2xl font-bold text-[#DC75A5]">
                <span className="h-6 w-1.5 rounded-full bg-[#DC75A5]" />
                <h2 className="font-display tracking-tight">{group.label}</h2>
              </div>

              {group.items.map((item) => (
                <article key={item.id} id={buildAnchorId(item)} className="ly-surface-card rounded-[1.5rem] p-6 scroll-mt-24">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#DC75A5]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#DC75A5]">
                          #{item.sortOrder}
                        </span>
                        {item.isFeatured ? (
                          <span className="rounded-md bg-[#2f2e33]/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2f2e33]">
                            重点
                          </span>
                        ) : null}
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${certaintyBadgeClassNames[item.certainty]}`}
                        >
                          {certaintyLabels[item.certainty]}
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#2f2e33]">{item.title}</h3>
                      {item.summary ? (
                        <p className="mt-3 text-[15px] leading-7 text-stone-700">{item.summary}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-stone-600">{item.content}</div>

                  <div className="mt-5 rounded-[1.2rem] bg-white/45 px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">来源</p>
                    <div className="mt-3 grid gap-2">
                      {(item.sourceLinks.length > 0 ? item.sourceLinks : [
                        {
                          id: `${item.id}-primary`,
                          issueItemId: item.id,
                          url: item.sourceUrl,
                          label: item.sourceName ?? "主来源",
                          sourceName: item.sourceName,
                          sortOrder: 1,
                          createdAt: item.createdAt,
                        },
                      ]).map((sourceLink) => (
                        <a
                          key={sourceLink.id}
                          href={sourceLink.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-sm leading-6 text-stone-600 transition hover:text-[#DC75A5]"
                        >
                          <span className="font-bold text-[#2f2e33]">{sourceLink.label ?? sourceLink.sourceName ?? "来源"}</span>
                          <span className="ml-2 text-stone-500">{sourceLink.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}
