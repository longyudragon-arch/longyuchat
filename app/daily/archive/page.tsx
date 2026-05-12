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

  const latestIssue = issues[0] ?? null;
  const latestIssueReadMinutes = latestIssue ? estimateDailyReadMinutes(latestIssue.itemCount) : null;

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.75rem] px-5 py-7 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(110deg,transparent,color-mix(in_srgb,var(--accent)_16%,transparent),rgba(20,184,166,0.06))] lg:block" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.45fr)] lg:items-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">日报归档</p>
              <h1 className="mt-3 text-balance font-display text-[2.15rem] font-black leading-tight text-[var(--foreground)] sm:text-[3rem]">
                把每天的 AI 变化放进同一个索引里
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] font-semibold leading-8 text-slate-600">
                按日期浏览，也可以直接搜索关键词、模型或公司名。这里的每一期都保留着标题、摘要和阅读时间，方便快速回看。
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-bold text-slate-500">
                <span>{stats.publishedIssueCount} 期日报</span>
                <span>·</span>
                <span>{stats.publishedItemCount} 条内容</span>
                <span>·</span>
                <span>更新至 {formatDailyDate(stats.latestIssueDate)}</span>
              </div>
            </div>

            <div className="ly-soft-card grid gap-4 p-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">搜索归档</p>
                <form method="GET" className="mt-3 grid gap-3">
                  <input
                    id="daily-archive-search"
                    name="q"
                    defaultValue={query}
                    className="ly-control bg-white/45"
                    placeholder="日期、模型、公司或主题"
                  />
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Link
                      href="/daily"
                      className="ly-page-action ly-secondary-action px-4 text-[13px] font-bold"
                    >
                    阅读今日详情
                    </Link>
                    <button type="submit" className="ly-primary-action inline-flex px-6 py-3 font-bold">
                      搜索
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-[1.2rem] border border-white/70 bg-white/55 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">最新一期</p>
                {latestIssue ? (
                  <Link href={`/daily/${latestIssue.slug}`} className="group mt-3 block">
                    <p className="text-sm font-bold text-slate-500">{formatDailyDate(latestIssue.issueDate)}</p>
                    <h2 className="mt-2 text-balance text-[1.2rem] font-black leading-tight text-[var(--foreground)] transition group-hover:text-[var(--accent)]">
                      {latestIssue.title}
                    </h2>
                    <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                      {getDailyIssueDek(latestIssue)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-bold text-slate-500">
                      <span>{latestIssue.itemCount} 条</span>
                      <span>·</span>
                      <span>{latestIssueReadMinutes} 分钟读完</span>
                    </div>
                  </Link>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-slate-500">当前没有可展示的日报。</p>
                )}
              </div>
            </div>
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
            <div className="mt-5 grid gap-3">
              {filteredIssues.map((issue, index) => (
                <Link
                  key={issue.id}
                  href={`/daily/${issue.slug}`}
                  className="ly-daily-issue-row grid gap-4 rounded-[1.2rem] border border-transparent bg-white/38 px-4 py-4 transition hover:bg-white/58 sm:grid-cols-[7.25rem_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 font-display text-[1rem] font-black text-[var(--accent)]">
                      {formatDailyDate(issue.issueDate).slice(5)}
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {formatDailyDate(issue.issueDate)}
                      </p>
                      {index === 0 ? (
                        <span className="mt-1 inline-flex rounded-full bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-black text-[var(--accent)]">
                          最新
                        </span>
                      ) : null}
                    </div>
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
