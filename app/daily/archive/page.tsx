import Link from "next/link";

import { getDailyIssueStats, listPublishedDailyIssues } from "@/server/services/daily-issue-service";

export const dynamic = "force-dynamic";

export default async function DailyArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, issues, stats] = await Promise.all([
    searchParams,
    listPublishedDailyIssues(200),
    getDailyIssueStats(),
  ]);
  const query = q?.trim() ?? "";
  const filteredIssues =
    query.length === 0
      ? issues
      : issues.filter((issue) => {
          const haystack = `${issue.issueDate}\n${issue.title}\n${issue.summary ?? ""}`.toLowerCase();
          return haystack.includes(query.toLowerCase());
        });

  return (
    <main className="ly-page-wrap">
      <div className="ly-shell flex flex-col gap-5">
        <section className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          <div className="ly-page-header">
            <div className="ly-page-heading">
              <h1 className="ly-page-title">日报归档</h1>
              <p className="ly-page-subtitle">按日期浏览 LongyuChat 的 AI 日报历史记录。</p>
            </div>
            <div className="ly-page-actions">
              <Link href="/daily" className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold">
                返回日报首页
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="ly-surface-card rounded-[1.5rem] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">累计期数</p>
            <p className="mt-3 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{stats.publishedIssueCount}</p>
          </div>
          <div className="ly-surface-card rounded-[1.5rem] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">累计条目</p>
            <p className="mt-3 text-3xl font-display font-bold tracking-tight text-[#2f2e33]">{stats.publishedItemCount}</p>
          </div>
          <div className="ly-surface-card rounded-[1.5rem] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">最近更新</p>
            <p className="mt-3 text-2xl font-display font-bold tracking-tight text-[#2f2e33]">{stats.latestIssueDate ?? "暂无"}</p>
          </div>
        </section>

        <section className="ly-surface-card rounded-[1.75rem] p-6">
          <form method="GET" className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              name="q"
              defaultValue={query}
              className="ly-control"
              placeholder="搜索标题或日期，例如 2026-04-22 / DeepSeek / Kimi"
            />
            <button type="submit" className="ly-primary-action inline-flex px-6 py-3 font-bold">
              搜索归档
            </button>
          </form>

          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-stone-500">
              {query ? `搜索“${query}”共匹配 ${filteredIssues.length} 期` : `共收录 ${filteredIssues.length} 期日报`}
            </p>
          </div>

          {filteredIssues.length === 0 ? (
            <p className="text-sm text-stone-500">当前还没有已发布的日报。</p>
          ) : (
            <div className="grid gap-4">
              {filteredIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/daily/${issue.slug}`}
                  className="rounded-[1.25rem] bg-white/40 px-4 py-4 transition hover:bg-white/70"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">{issue.issueDate}</p>
                      <p className="mt-1 font-bold text-[#2f2e33]">{issue.title}</p>
                      <p className="mt-1 text-sm leading-6 text-stone-500">{issue.summary ?? "暂无导语"}</p>
                    </div>
                    <span className="text-sm text-stone-500">{issue.itemCount} 条</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
