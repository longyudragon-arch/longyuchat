import Link from "next/link";

import { getDailyIssueStats, listPublishedDailyIssues } from "@/server/services/daily-issue-service";

export const dynamic = "force-dynamic";

export default async function DailyIndexPage() {
  const [issues, stats] = await Promise.all([
    listPublishedDailyIssues(20),
    getDailyIssueStats(),
  ]);
  const latestIssue = issues[0] ?? null;

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
        <section className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          <div className="ly-page-header">
            <div className="ly-page-heading">
              <h1 className="ly-page-title">AI 日报</h1>
              <p className="ly-page-subtitle">
                LongyuChat 自动生成的 AI 日报，按日归档，持续沉淀。
              </p>
            </div>
            <div className="ly-page-actions">
              <Link href="/daily/archive" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                历史归档
              </Link>
              <Link href="/admin/daily" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                日报后台
              </Link>
              <Link href="/api/daily/rss" className="ly-page-action rounded-xl border border-transparent bg-[var(--accent)] px-4 text-[13px] font-bold text-white shadow-sm shadow-[var(--accent)]/20">
                RSS
              </Link>
            </div>
          </div>
        </section>

        {latestIssue ? (
          <section className="ly-surface-card rounded-[1.75rem] p-6 sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#DC75A5]">最新一期</p>
            <h2 className="mt-3 text-2xl font-display font-bold tracking-tight text-[#2f2e33] sm:text-[2.2rem]">
              <Link href={`/daily/${latestIssue.slug}`} className="hover:text-[#DC75A5]">
                {latestIssue.title}
              </Link>
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-stone-600">
              {latestIssue.summary ?? "这期日报包含当前 AI 领域最值得关注的自动筛选条目。"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] font-medium text-stone-500">
              <span>{latestIssue.issueDate}</span>
              <span>·</span>
              <span>{latestIssue.itemCount} 条</span>
            </div>
          </section>
        ) : (
          <section className="ly-surface-card rounded-[1.75rem] p-8 text-center text-stone-500">
            当前还没有已发布的日报。
          </section>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="ly-surface-card rounded-[1.5rem] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">累计期数</p>
            <p className="mt-3 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">
              {stats.publishedIssueCount}
            </p>
            <p className="mt-1 text-xs leading-6 text-stone-500">目前累计已发布的 AI 日报期数。</p>
          </div>
          <div className="ly-surface-card rounded-[1.5rem] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">累计条目</p>
            <p className="mt-3 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">
              {stats.publishedItemCount}
            </p>
            <p className="mt-1 text-xs leading-6 text-stone-500">所有已发布日报中累计收录的条目数。</p>
          </div>
          <div className="ly-surface-card rounded-[1.5rem] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">最近更新</p>
            <p className="mt-3 text-2xl font-display font-bold tracking-tight text-[#2f2e33]">
              {stats.latestIssueDate ?? "暂无"}
            </p>
            <p className="mt-1 text-xs leading-6 text-stone-500">最近一次成功发布日报的日期。</p>
          </div>
        </section>

        <section className="ly-surface-card rounded-[1.75rem] p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">如何查询过往日报</p>
              <h3 className="mt-2 text-xl font-display font-bold tracking-tight text-[#2f2e33]">按日期归档查看历史日报</h3>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                所有已发布日报都保存在归档页。你可以按日期浏览，也可以在归档页里搜索标题和日期。
              </p>
            </div>
            <Link href="/daily/archive" className="ly-primary-action inline-flex px-6 py-3 font-bold">
              打开归档
            </Link>
          </div>
        </section>

        <section className="grid gap-5">
          {issues.length === 0 ? null : issues.map((issue) => (
            <article key={issue.id} className="ly-glass rounded-[1.5rem] px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">{issue.issueDate}</p>
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-[#2f2e33]">
                    <Link href={`/daily/${issue.slug}`} className="hover:text-[#DC75A5]">
                      {issue.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    {issue.summary ?? "暂无导语"}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[12px] text-stone-500">
                  <p>{issue.itemCount} 条</p>
                  <p className="mt-1">{issue.status}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
