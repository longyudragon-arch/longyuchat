import Link from "next/link";
import { notFound } from "next/navigation";

import {
  buildDailyAnchorId,
  buildDailyHeroCopy,
  dailyCategoryLabels,
  dailyCertaintyBadgeClassNames,
  dailyCertaintyLabels,
  estimateDailyReadMinutes,
  formatDailyDate,
  getDailySourceHost,
  groupDailyItemsByCategory,
  truncateDailyText,
} from "@/lib/daily-presentation";
import { getDailyIssueBySlug } from "@/server/services/daily-issue-service";
import type { DailyIssueItemView } from "@/types/daily";

export const dynamic = "force-dynamic";

function getItemSourceLinks(item: DailyIssueItemView) {
  if (item.sourceLinks.length > 0) {
    return item.sourceLinks;
  }

  return [
    {
      id: `${item.id}-primary`,
      url: item.sourceUrl,
      label: item.sourceName ?? "主来源",
      sourceName: item.sourceName,
    },
  ];
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

  const issueItems = issue.items ?? [];
  const groups = groupDailyItemsByCategory(issueItems);
  const hero = buildDailyHeroCopy(issue);
  const readMinutes = estimateDailyReadMinutes(issue.itemCount);
  const featuredCount = issueItems.filter((item) => item.isFeatured).length;

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.65rem] px-5 py-5 sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[linear-gradient(110deg,transparent,color-mix(in_srgb,var(--accent)_14%,transparent),rgba(20,184,166,0.05))] lg:block" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5 text-[12px] font-bold text-slate-500">
                <Link href="/daily" className="text-[var(--accent)] transition hover:text-[var(--accent-strong)]">
                  AI 日报
                </Link>
                <span>·</span>
                <span>{formatDailyDate(issue.issueDate)}</span>
                <span>·</span>
                <span>{issue.itemCount} 条重点</span>
                <span>·</span>
                <span>{readMinutes} 分钟</span>
              </div>
              <Link href="/daily/archive" className="ly-page-action ly-secondary-action self-start px-4 text-[13px] font-bold sm:self-auto">
                查看归档
              </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.34fr)] lg:items-start">
              <div className="max-w-[52rem]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">今日详情</p>
                <h1 className="mt-3 text-balance font-display text-[2rem] font-black leading-[1.08] text-[var(--foreground)] sm:text-[2.45rem] lg:text-[2.8rem]">
                  {hero.displayTitle}
                </h1>
                <p className="mt-4 max-w-[46rem] text-[15px] font-semibold leading-8 text-slate-600 sm:text-base">
                  {hero.displaySummary}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a href="#daily-read-start" className="ly-primary-action inline-flex px-5 py-3 font-bold">
                    开始阅读
                  </a>
                  <a href="#daily-overview" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                    快速扫读
                  </a>
                </div>
              </div>

              <aside className="ly-soft-card p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "重点", value: featuredCount || hero.leadItems.length },
                    { label: "栏目", value: groups.length },
                    { label: "分钟", value: readMinutes },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[0.95rem] bg-white/60 px-3 py-3 text-center">
                      <p className="font-display text-[1.45rem] font-black leading-none text-[var(--foreground)]">{item.value}</p>
                      <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-white/60 pt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">阅读路径</p>
                  <div className="mt-3 grid gap-1.5">
                    {groups.map((group) => (
                      <a
                        key={group.category}
                        href={`#category-${group.category}`}
                        className="flex items-center justify-between gap-4 rounded-[0.85rem] px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white/60 hover:text-[var(--accent)]"
                      >
                        <span>{group.label}</span>
                        <span>{group.items.length} 条</span>
                      </a>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {hero.leadItems.length > 0 ? (
          <section id="daily-read-start" className="w-full scroll-mt-24 ly-surface-card rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">本期导读</p>
                <h2 className="mt-2 font-display text-2xl font-black text-[var(--foreground)]">先看结论，再进入正文</h2>
              </div>
              <p className="text-sm font-bold text-slate-500">{hero.leadItems.length} 条重点</p>
            </div>

            <div className="mt-5 grid gap-3">
              {hero.leadItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${buildDailyAnchorId(item)}`}
                  className="group grid gap-3 rounded-[1.15rem] border border-white/70 bg-white/54 px-4 py-4 transition hover:border-[var(--accent)]/20 hover:bg-white/72 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex items-center gap-2 sm:block">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/10 font-display text-base font-black text-[var(--accent)]">
                      {item.sortOrder}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-black sm:mt-2 sm:inline-flex ${dailyCertaintyBadgeClassNames[item.certainty]}`}
                    >
                      {dailyCertaintyLabels[item.certainty]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[var(--accent)]">{dailyCategoryLabels[item.category]}</p>
                    <h3 className="mt-1 text-lg font-black leading-7 text-[var(--foreground)] transition group-hover:text-[var(--accent)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm font-medium leading-7 text-slate-600">
                      {truncateDailyText(item.summary ?? item.content, 96)}
                    </p>
                  </div>
                  <span className="hidden text-sm font-black text-slate-400 transition group-hover:text-[var(--accent)] sm:inline">
                    阅读
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section id="daily-overview" className="w-full scroll-mt-24 ly-surface-card rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">栏目索引</p>
              <h2 className="mt-2 font-display text-2xl font-black text-[var(--foreground)]">按栏目快速扫读</h2>
            </div>
            <span className="text-sm font-bold text-slate-500">{groups.length} 个栏目</span>
          </div>

          <div className="mt-5 divide-y divide-slate-200/60 rounded-[1.15rem] border border-white/70 bg-white/42">
            {groups.map((group) => (
              <div key={group.category} className="grid gap-3 px-4 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
                <div className="flex items-center justify-between gap-3 sm:block">
                  <p className="text-sm font-black text-[var(--accent)]">{group.label}</p>
                  <p className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-black text-[var(--accent)] sm:mt-2 sm:inline-flex">
                    {group.items.length} 条
                  </p>
                </div>
                <div className="grid gap-2">
                  {group.items.slice(0, 4).map((item) => (
                    <a
                      key={item.id}
                      href={`#${buildDailyAnchorId(item)}`}
                      className="min-w-0 text-sm font-semibold leading-6 text-slate-700 transition hover:text-[var(--accent)]"
                    >
                      <span className="mr-2 text-xs font-black text-slate-400">#{item.sortOrder}</span>
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid w-full gap-8">
          {groups.map((group) => (
            <section key={group.category} id={`category-${group.category}`} className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3 px-1 text-[var(--accent)]">
                <span className="h-6 w-1.5 rounded-full bg-[var(--accent)]" />
                <h2 className="font-display text-2xl font-black">{group.label}</h2>
              </div>

              {group.items.map((item) => {
                const sourceLinks = getItemSourceLinks(item);

                return (
                  <article key={item.id} id={buildDailyAnchorId(item)} className="ly-surface-card scroll-mt-24 rounded-[1.5rem] p-5 sm:p-7">
                    <div className="grid gap-5 lg:grid-cols-[4.25rem_minmax(0,1fr)]">
                      <div className="flex items-center gap-2 lg:block">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 font-display text-xl font-black text-[var(--accent)]">
                          {item.sortOrder}
                        </span>
                        {item.isFeatured ? (
                          <span className="rounded-md bg-[var(--foreground)]/8 px-2 py-0.5 text-[10px] font-black text-[var(--foreground)] lg:mt-2 lg:inline-flex">
                            重点
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${dailyCertaintyBadgeClassNames[item.certainty]}`}
                          >
                            {dailyCertaintyLabels[item.certainty]}
                          </span>
                          <span className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-black text-[var(--accent)]">
                            {group.label}
                          </span>
                        </div>

                        <h3 className="mt-3 max-w-[46rem] text-balance text-[1.55rem] font-black leading-tight text-[var(--foreground)] sm:text-2xl">
                          {item.title}
                        </h3>
                        {item.summary ? (
                          <p className="mt-3 max-w-[48rem] break-words rounded-[1.05rem] bg-[var(--accent)]/5 px-4 py-3 text-[15px] font-semibold leading-8 text-slate-700">
                            {item.summary}
                          </p>
                        ) : null}

                        <div className="mt-4 max-w-[48rem] whitespace-pre-wrap break-words rounded-[1.05rem] bg-white/45 px-4 py-4 text-[15px] font-medium leading-8 text-slate-600 sm:text-base">
                          {item.content}
                        </div>

                        <div className="mt-5 max-w-[48rem] border-t border-slate-200/70 pt-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">来源</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {sourceLinks.map((sourceLink) => (
                              <a
                                key={sourceLink.id}
                                href={sourceLink.url}
                                target="_blank"
                                rel="noreferrer"
                                className="group inline-flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-[var(--accent)]/25 hover:text-[var(--accent)]"
                              >
                                <span className="truncate">{sourceLink.label ?? sourceLink.sourceName ?? "打开来源"}</span>
                                <span className="max-w-[12rem] truncate text-xs font-bold text-slate-400 transition group-hover:text-[var(--accent)]">
                                  {getDailySourceHost(sourceLink.url)}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}
