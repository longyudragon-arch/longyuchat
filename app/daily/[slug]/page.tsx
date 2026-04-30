import Link from "next/link";
import { notFound } from "next/navigation";

import {
  buildDailyAnchorId,
  buildDailyHeroCopy,
  dailyCertaintyBadgeClassNames,
  dailyCertaintyLabels,
  estimateDailyReadMinutes,
  formatDailyDate,
  getDailySourceHost,
  groupDailyItemsByCategory,
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

  const groups = groupDailyItemsByCategory(issue.items ?? []);
  const hero = buildDailyHeroCopy(issue);
  const readMinutes = estimateDailyReadMinutes(issue.itemCount);
  const featuredCount = (issue.items ?? []).filter((item) => item.isFeatured).length;

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.9rem] px-5 py-6 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(110deg,transparent,color-mix(in_srgb,var(--accent)_16%,transparent),rgba(20,184,166,0.07))] lg:block" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold text-slate-500">
                <Link href="/daily" className="text-[var(--accent)] transition hover:text-[var(--accent-strong)]">
                  AI 日报
                </Link>
                <span>·</span>
                <span>{formatDailyDate(issue.issueDate)}</span>
                <span>·</span>
                <span>{issue.itemCount} 条</span>
                <span>·</span>
                <span>{readMinutes} 分钟读完</span>
              </div>
              <Link href="/daily/archive" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                查看归档
              </Link>
            </div>

            <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.38fr)] xl:items-center">
              <div className="space-y-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">今日头版</p>
                <h1 className="max-w-4xl text-balance font-display text-[2rem] font-black leading-tight text-[var(--foreground)] sm:text-[2.55rem] lg:text-[3rem]">
                  {hero.displayTitle}
                </h1>
                <p className="max-w-4xl text-[15px] font-semibold leading-8 text-slate-600 sm:text-base">
                  {hero.displaySummary}
                </p>
                {hero.heroTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">
                    {hero.heroTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--accent)]/15 bg-white/55 px-3 py-1.5 text-[11px] font-black text-[var(--accent)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className="ly-soft-card hidden p-4 sm:block sm:p-5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "重点", value: featuredCount || hero.leadItems.length },
                    { label: "栏目", value: groups.length },
                    { label: "分钟", value: readMinutes },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[1rem] bg-white/55 px-3 py-3 text-center">
                      <p className="font-display text-2xl font-black text-[var(--foreground)]">{item.value}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">本期目录</p>
                <div className="mt-3 grid gap-1.5">
                  {groups.map((group) => (
                    <a
                      key={group.category}
                      href={`#category-${group.category}`}
                      className="flex items-center justify-between gap-4 rounded-[0.9rem] px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white/55 hover:text-[var(--accent)]"
                    >
                      <span>{group.label}</span>
                      <span>{group.items.length} 条</span>
                    </a>
                  ))}
                </div>

                {hero.leadItems.length > 0 ? (
                  <div className="mt-5 border-t border-white/60 pt-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">先看这几条</p>
                    <div className="mt-3 grid gap-2">
                      {hero.leadItems.map((item) => (
                        <a
                          key={item.id}
                          href={`#${buildDailyAnchorId(item)}`}
                          className="text-sm font-bold leading-6 text-slate-700 transition hover:text-[var(--accent)]"
                        >
                          {item.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[64rem] ly-surface-card rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">概览</p>
              <h2 className="mt-2 font-display text-2xl font-black text-[var(--foreground)]">按栏目快速扫读</h2>
            </div>
            <span className="text-sm font-bold text-slate-500">{groups.length} 个栏目</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {groups.map((group) => (
              <div key={group.category} className="rounded-[1.1rem] border border-white/60 bg-white/48 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-[var(--accent)]">{group.label}</p>
                  <p className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-black text-[var(--accent)]">{group.items.length} 条</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {group.items.slice(0, 3).map((item) => (
                    <a
                      key={item.id}
                      href={`#${buildDailyAnchorId(item)}`}
                      className="text-sm font-semibold leading-6 text-slate-700 transition hover:text-[var(--accent)]"
                    >
                      {item.title}
                    </a>
                  ))}
                  {group.items.length > 3 ? (
                    <a href={`#category-${group.category}`} className="text-xs font-black text-slate-400 transition hover:text-[var(--accent)]">
                      继续查看 {group.items.length - 3} 条
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-[64rem] gap-6">
          {groups.map((group) => (
            <section key={group.category} id={`category-${group.category}`} className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3 px-1 text-[var(--accent)]">
                <span className="h-6 w-1.5 rounded-full bg-[var(--accent)]" />
                <h2 className="font-display text-2xl font-black">{group.label}</h2>
              </div>

              {group.items.map((item) => {
                const sourceLinks = getItemSourceLinks(item);

                return (
                  <article key={item.id} id={buildDailyAnchorId(item)} className="ly-surface-card ly-surface-card-hover scroll-mt-24 rounded-[1.5rem] p-5 sm:p-6">
                    <div className="grid gap-4 lg:grid-cols-[4rem_minmax(0,1fr)]">
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

                        <h3 className="mt-3 text-balance text-2xl font-black leading-tight text-[var(--foreground)]">{item.title}</h3>
                        {item.summary ? (
                          <p className="mt-3 rounded-[1.1rem] bg-[var(--accent)]/5 px-4 py-3 text-[15px] font-semibold leading-8 text-slate-700">{item.summary}</p>
                        ) : null}

                        <div className="mt-4 whitespace-pre-wrap rounded-[1.1rem] bg-white/45 px-4 py-4 text-[15px] font-medium leading-8 text-slate-600">
                          {item.content}
                        </div>

                        <div className="mt-5 border-t border-slate-200/70 pt-4">
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
