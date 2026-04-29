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

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.9rem] px-5 py-6 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(110deg,transparent,rgba(96,165,250,0.16),rgba(20,184,166,0.08))] lg:block" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold text-slate-500">
                <Link href="/daily" className="text-[#2563EB] transition hover:text-[#1d4ed8]">
                  AI 日报
                </Link>
                <span>·</span>
                <span>{formatDailyDate(issue.issueDate)}</span>
                <span>·</span>
                <span>{issue.itemCount} 条</span>
                <span>·</span>
                <span>{estimateDailyReadMinutes(issue.itemCount)} 分钟读完</span>
              </div>
              <Link href="/daily/archive" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                查看归档
              </Link>
            </div>

            <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)] xl:items-end">
              <div className="space-y-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">今日头版</p>
                <h1 className="max-w-4xl font-display text-[2rem] font-black leading-tight text-[#0F1A2B] sm:text-[2.55rem] lg:text-[3rem]">
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
                        className="rounded-full border border-[#2563EB]/15 bg-white/55 px-3 py-1.5 text-[11px] font-black text-[#2563EB]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <aside className="border-t border-white/60 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">本期目录</p>
                <div className="mt-3 grid gap-2">
                  {groups.map((group) => (
                    <a
                      key={group.category}
                      href={`#category-${group.category}`}
                      className="flex items-center justify-between gap-4 py-2 text-sm font-bold text-slate-600 transition hover:text-[#2563EB]"
                    >
                      <span>{group.label}</span>
                      <span>{group.items.length} 条</span>
                    </a>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="ly-surface-card rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">概览</p>
              <h2 className="mt-2 font-display text-2xl font-black text-[#0F1A2B]">按栏目快速扫读</h2>
            </div>
            <span className="text-sm font-bold text-slate-500">{groups.length} 个栏目</span>
          </div>
          <div className="mt-5 divide-y divide-slate-200/60">
            {groups.map((group) => (
              <div key={group.category} className="grid gap-3 py-4 lg:grid-cols-[8rem_minmax(0,1fr)]">
                <div>
                  <p className="text-sm font-black text-[#2563EB]">{group.label}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{group.items.length} 条</p>
                </div>
                <div className="grid gap-2">
                  {group.items.map((item) => (
                    <a
                      key={item.id}
                      href={`#${buildDailyAnchorId(item)}`}
                      className="text-sm font-semibold leading-6 text-slate-700 transition hover:text-[#2563EB]"
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6">
          {groups.map((group) => (
            <section key={group.category} id={`category-${group.category}`} className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3 px-1 text-[#2563EB]">
                <span className="h-6 w-1.5 rounded-full bg-[#2563EB]" />
                <h2 className="font-display text-2xl font-black">{group.label}</h2>
              </div>

              {group.items.map((item) => {
                const sourceLinks = getItemSourceLinks(item);

                return (
                  <article key={item.id} id={buildDailyAnchorId(item)} className="ly-surface-card ly-surface-card-hover scroll-mt-24 rounded-[1.5rem] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-black text-[#2563EB]">
                        #{item.sortOrder}
                      </span>
                      {item.isFeatured ? (
                        <span className="rounded-md bg-[#0F1A2B]/8 px-2 py-0.5 text-[10px] font-black text-[#0F1A2B]">
                          重点
                        </span>
                      ) : null}
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${dailyCertaintyBadgeClassNames[item.certainty]}`}
                      >
                        {dailyCertaintyLabels[item.certainty]}
                      </span>
                    </div>

                    <h3 className="mt-3 text-2xl font-black leading-tight text-[#0F1A2B]">{item.title}</h3>
                    {item.summary ? (
                      <p className="mt-3 text-[15px] font-semibold leading-8 text-slate-700">{item.summary}</p>
                    ) : null}

                    <div className="mt-4 whitespace-pre-wrap text-[15px] font-medium leading-8 text-slate-600">
                      {item.content}
                    </div>

                    <div className="mt-5 border-t border-slate-200/70 pt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">来源</p>
                      <div className="mt-2 grid gap-1">
                        {sourceLinks.map((sourceLink) => (
                          <a
                            key={sourceLink.id}
                            href={sourceLink.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex flex-col gap-1 py-2 text-sm font-semibold text-slate-600 transition hover:text-[#2563EB] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span>{sourceLink.label ?? sourceLink.sourceName ?? "打开来源"}</span>
                            <span className="break-all text-xs font-bold text-slate-400 transition group-hover:text-[#2563EB]">
                              {getDailySourceHost(sourceLink.url)}
                            </span>
                          </a>
                        ))}
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
