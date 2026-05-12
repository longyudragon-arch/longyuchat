import Link from "next/link";
import { redirect } from "next/navigation";

import { listPublishedDailyIssues } from "@/server/services/daily-issue-service";

export const dynamic = "force-dynamic";

export default async function DailyIndexPage() {
  const latestIssue = (await listPublishedDailyIssues(1))[0] ?? null;

  if (latestIssue) {
    redirect(`/daily/${latestIssue.slug}`);
  }

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise">
        <section className="ly-glass rounded-[1.75rem] px-5 py-8 sm:px-7 sm:py-10">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">AI 日报</p>
          <h1 className="mt-3 font-display text-[2rem] font-black leading-tight text-[var(--foreground)] sm:text-[2.75rem]">
            暂时还没有可读的日报
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
            等待后台发布后，这里会自动跳到最新一期阅读页。
          </p>
          <div className="mt-5">
            <Link href="/daily/archive" className="ly-primary-action inline-flex px-5 py-3 font-bold">
              查看归档
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
