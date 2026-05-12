import Link from "next/link";

import {
  formatDailyDate,
  formatDailyYear,
  getDailyMajorEventCategoryLabel,
} from "@/lib/daily-presentation";
import { listDailyMajorEvents } from "@/server/services/daily-major-event-service";

export const dynamic = "force-dynamic";

function groupEventsByYear(events: Awaited<ReturnType<typeof listDailyMajorEvents>>) {
  const groups = new Map<string, typeof events>();

  for (const event of events) {
    const year = formatDailyYear(event.eventDate);
    groups.set(year, [...(groups.get(year) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([year, items]) => ({
    year,
    items,
  }));
}

export default async function DailyMajorEventsPage() {
  const events = await listDailyMajorEvents({ limit: 200, order: "asc", minimumImportanceScore: 90 });
  const groups = groupEventsByYear(events);

  return (
    <main className="ly-page-wrap ly-page-daily">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.75rem] px-5 py-7 sm:px-7 sm:py-8">
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.45fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">AI 大事件</p>
              <h1 className="mt-3 text-balance font-display text-[2.15rem] font-black leading-tight text-[var(--foreground)] sm:text-[3rem]">
                把每年的关键 AI 节点按时间留下来
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] font-semibold leading-8 text-slate-600">
                这里只收录真正影响模型、产品、开发者生态和行业判断的大事件。每条都保留来源，方便回看和查证。
              </p>
            </div>

            <div className="ly-soft-card p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">当前收录</p>
              <p className="mt-2 font-display text-3xl font-black text-[var(--foreground)]">{events.length}</p>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                按日期升序展示，后续会从日报头条和外部精选源继续补全。
              </p>
              <Link href="/daily" className="mt-4 inline-flex text-sm font-black text-slate-500 transition hover:text-[var(--accent)]">
                返回 AI 日报
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-[64rem] gap-8">
          {groups.map((group) => (
            <section key={group.year} className="grid gap-4">
              <div className="flex items-center gap-3 px-1 text-[var(--accent)]">
                <span className="h-6 w-1.5 rounded-full bg-[var(--accent)]" />
                <h2 className="font-display text-2xl font-black">{group.year}</h2>
              </div>

              <div className="grid gap-3">
                {group.items.map((event, index) => (
                  <article key={event.id} className="ly-surface-card rounded-[1.35rem] p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                      <div>
                        <p className="font-display text-xl font-black text-[var(--accent)]">{formatDailyDate(event.eventDate).slice(5)}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                          #{index + 1}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[10px] font-black text-[var(--accent)]">
                            {getDailyMajorEventCategoryLabel(event.category)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">重要度 {event.importanceScore}</span>
                        </div>
                        <h3 className="mt-3 text-balance text-xl font-black leading-8 text-[var(--foreground)]">{event.title}</h3>
                        <p className="mt-2 text-[15px] font-medium leading-8 text-slate-600">{event.summary}</p>
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex text-sm font-black text-slate-500 transition hover:text-[var(--accent)]"
                        >
                          来源：{event.sourceName ?? "原始链接"}
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}
