import Link from "next/link";

import {
  estimateDailyReadMinutes,
  formatDailyDate,
  getDailyIssueDek,
} from "@/lib/daily-presentation";
import { getDailyIssueStats, listPublishedDailyIssues } from "@/server/services/daily-issue-service";

export const dynamic = "force-dynamic";

export default async function DailyIndexPage() {
  const [issues, stats] = await Promise.all([
    listPublishedDailyIssues(20),
    getDailyIssueStats(),
  ]);
  const latestIssue = issues[0] ?? null;
  const previousIssues = issues.slice(1);

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.75rem] px-5 py-7 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(110deg,transparent,rgba(96,165,250,0.18),rgba(20,184,166,0.08))] lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">
                AI 日报 · 中文精选
              </p>
              <h1 className="mt-4 max-w-2xl font-display text-[2.25rem] font-black leading-[1.05] text-[#0F1A2B] sm:text-[3.2rem] lg:text-[4rem]">
                每天一份 AI 变化清单
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-8 text-slate-600 sm:text-base">
                聚焦模型发布、产品变化、开发生态和行业信号。适合快速扫读，也适合回头查证。
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {latestIssue ? (
                  <Link href={`/daily/${latestIssue.slug}`} className="ly-primary-action inline-flex px-5 py-3 font-bold">
                    阅读最新一期
                  </Link>
                ) : null}
                <Link href="/daily/archive" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                  历史归档
                </Link>
                <Link href="/api/daily/rss" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                  RSS 订阅
                </Link>
              </div>
            </div>

            <aside className="border-t border-white/60 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">今日头版</p>
              {latestIssue ? (
                <Link href={`/daily/${latestIssue.slug}`} className="group mt-3 block">
                  <p className="text-sm font-bold text-slate-500">{formatDailyDate(latestIssue.issueDate)}</p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-[#0F1A2B] transition group-hover:text-[#2563EB]">
                    {latestIssue.title}
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                    {getDailyIssueDek(latestIssue)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-bold text-slate-500">
                    <span>{latestIssue.itemCount} 条重点</span>
                    <span>·</span>
                    <span>{estimateDailyReadMinutes(latestIssue.itemCount)} 分钟读完</span>
                  </div>
                </Link>
              ) : (
                <p className="mt-3 text-sm leading-7 text-slate-500">当前还没有已发布的日报。</p>
              )}
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="ly-surface-card rounded-[1.45rem] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">已发布</p>
            <p className="mt-3 font-display text-3xl font-black text-[#0F1A2B]">{stats.publishedIssueCount}</p>
            <p className="mt-1 text-xs font-medium leading-6 text-slate-500">持续沉淀的日报期数。</p>
          </div>
          <div className="ly-surface-card rounded-[1.45rem] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">总条目</p>
            <p className="mt-3 font-display text-3xl font-black text-[#0F1A2B]">{stats.publishedItemCount}</p>
            <p className="mt-1 text-xs font-medium leading-6 text-slate-500">已筛选进入日报的内容量。</p>
          </div>
          <div className="ly-surface-card rounded-[1.45rem] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">最近更新</p>
            <p className="mt-3 font-display text-2xl font-black text-[#0F1A2B]">{formatDailyDate(stats.latestIssueDate)}</p>
            <p className="mt-1 text-xs font-medium leading-6 text-slate-500">发布后会同步出现在 RSS。</p>
          </div>
        </section>

        <section className="ly-surface-card rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">近期日报</p>
              <h2 className="mt-2 font-display text-2xl font-black text-[#0F1A2B]">按时间回看 AI 变化</h2>
            </div>
            <Link href="/admin/daily" className="ly-page-action ly-secondary-action w-fit px-4 text-[13px] font-bold">
              日报后台
            </Link>
          </div>

          {issues.length === 0 ? (
            <div className="mt-6 rounded-[1.2rem] border border-dashed border-slate-200 bg-white/35 p-6 text-sm font-medium text-slate-500">
              当前还没有已发布的日报。
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-200/60">
              {issues.map((issue, index) => (
                <article key={issue.id} className="hover-lift grid gap-4 rounded-[1.1rem] px-3 py-5 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex items-center gap-2 text-[12px] font-black text-[#2563EB] sm:block">
                    <span>{formatDailyDate(issue.issueDate)}</span>
                    {index === 0 ? (
                      <span className="rounded-full bg-[#2563EB]/10 px-2 py-1 text-[10px] text-[#2563EB] sm:mt-2 sm:inline-flex">
                        最新
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black leading-7 text-[#0F1A2B]">
                      <Link href={`/daily/${issue.slug}`} className="transition hover:text-[#2563EB]">
                        {issue.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-7 text-slate-600">{getDailyIssueDek(issue)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-[12px] font-bold text-slate-500 sm:justify-end">
                    <span>{issue.itemCount} 条</span>
                    <span>·</span>
                    <span>{estimateDailyReadMinutes(issue.itemCount)} min</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {previousIssues.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="ly-glass rounded-[1.5rem] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#2563EB]">稳定栏目</p>
              <h2 className="mt-2 font-display text-xl font-black text-[#0F1A2B]">先看结论，再看来源</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                日报详情页会按要闻、模型发布、开发生态、产品应用等栏目展开，方便快速定位。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["要闻", "模型发布", "开发生态", "产品应用"].map((label) => (
                <div key={label} className="ly-glass ly-surface-card-hover rounded-[1.25rem] px-4 py-4">
                  <p className="text-sm font-black text-[#0F1A2B]">{label}</p>
                  <p className="mt-1 text-xs font-medium leading-6 text-slate-500">归纳后进入对应栏目。</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
