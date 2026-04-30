import Link from "next/link";

import {
  estimateDailyReadMinutes,
  formatDailyDate,
  getDailyIssueDek,
} from "@/lib/daily-presentation";
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
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.75rem] px-5 py-7 sm:px-7 sm:py-8">
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.6fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">日报归档</p>
              <h1 className="mt-3 text-balance font-display text-[2.15rem] font-black leading-tight text-[var(--foreground)] sm:text-[3rem]">
                按时间检索 AI 变化
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] font-semibold leading-8 text-slate-600">
                把每天的 AI 变化留在同一个索引里。按日期浏览，也可以直接搜索关键词或标题。
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-bold text-slate-500">
                <span>{stats.publishedIssueCount} 期日报</span>
                <span>·</span>
                <span>{stats.publishedItemCount} 条内容</span>
                <span>·</span>
                <span>更新至 {formatDailyDate(stats.latestIssueDate)}</span>
              </div>
            </div>

            <form method="GET" className="ly-soft-card grid gap-3 p-5">
              <label htmlFor="daily-archive-search" className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                搜索归档
              </label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  id="daily-archive-search"
                  name="q"
                  defaultValue={query}
                  className="ly-control bg-white/45"
                  placeholder="日期、模型、公司或主题"
                />
                <button type="submit" className="ly-primary-action inline-flex px-6 py-3 font-bold">
                  搜索
                </button>
              </div>
              <Link href="/daily" className="w-fit text-sm font-bold text-slate-500 transition hover:text-[var(--accent)]">
                返回日报首页
              </Link>
            </form>
          </div>
        </section>

        <section className="ly-surface-card rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">索引</p>
              <h2 className="mt-2 font-display text-2xl font-black text-[var(--foreground)]">
                {query ? `“${query}”的匹配结果` : "全部日报"}
              </h2>
            </div>
            <p className="text-sm font-bold text-slate-500">
              {query ? `共匹配 ${filteredIssues.length} 期` : `共收录 ${filteredIssues.length} 期`}
            </p>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="mt-6 rounded-[1.2rem] border border-dashed border-slate-200 bg-white/35 p-6 text-sm font-medium text-slate-500">
              没有找到匹配的日报。可以换一个关键词，或者回到全部归档。
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-200/60">
              {filteredIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/daily/${issue.slug}`}
                  className="ly-daily-issue-row hover-lift grid gap-4 rounded-[1.1rem] px-3 py-5 transition hover:bg-white/35 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
                >
                  <div className="text-[12px] font-black text-[var(--accent)]">
                    {formatDailyDate(issue.issueDate)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-7 text-[var(--foreground)]">{issue.title}</p>
                    <p className="mt-2 text-sm font-medium leading-7 text-slate-600">{getDailyIssueDek(issue)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-[12px] font-bold text-slate-500 sm:justify-end">
                    <span>{issue.itemCount} 条</span>
                    <span>·</span>
                    <span>{estimateDailyReadMinutes(issue.itemCount)} 分钟</span>
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
