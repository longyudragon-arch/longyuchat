import Link from "next/link";
import type { CSSProperties } from "react";

import { getDailyIssueDek } from "@/lib/daily-presentation";
import { prisma } from "@/lib/prisma";
import { getDailyIssueStats, listPublishedDailyIssues } from "@/server/services/daily-issue-service";

type PortalIconName = "about" | "chat" | "doc" | "project";

function PortalIcon({ name, className = "h-6 w-6" }: { name: PortalIconName; className?: string }) {
  const commonProps = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (name === "chat") {
    return (
      <svg {...commonProps}>
        <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5 9.2 9.2 0 0 1-3.8-.82L3 21l1.44-5.1A8.5 8.5 0 1 1 21 12Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </svg>
    );
  }

  if (name === "project") {
    return (
      <svg {...commonProps}>
        <path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" />
      </svg>
    );
  }

  if (name === "about") {
    return (
      <svg {...commonProps}>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M8 3h6l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function ArrowIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export async function HomeDashboard() {
  const [dailyIssues, dailyStats, modelStats, roomStats] = await Promise.all([
    listPublishedDailyIssues(4),
    getDailyIssueStats(),
    prisma.modelConfig.aggregate({
      _count: {
        _all: true,
      },
      where: {
        enabled: true,
      },
    }),
    prisma.chatRoom.aggregate({
      _count: {
        _all: true,
      },
    }),
  ]);

  const latestDailyIssue = dailyIssues[0] ?? null;
  const latestDailyItems = latestDailyIssue?.items?.slice(0, 3) ?? [];
  const readMinutes = latestDailyIssue ? Math.max(3, Math.ceil(latestDailyIssue.itemCount * 0.75)) : null;

  const entries = [
    {
      title: "AI 日报",
      description: "每日精选 AI 资讯与趋势",
      href: "/daily",
      icon: "doc" as const,
      color: "var(--accent)",
      bg: "rgba(37, 99, 235, 0.1)",
    },
    {
      title: "AI 聊天室",
      description: "房间、模型和顺序对话",
      href: "/rooms",
      icon: "chat" as const,
      color: "var(--chat-accent)",
      bg: "rgba(245, 158, 11, 0.16)",
    },
    {
      title: "项目推荐",
      description: "整理值得关注的开源项目",
      href: "/projects",
      icon: "project" as const,
      color: "var(--project-accent)",
      bg: "rgba(22, 163, 74, 0.11)",
    },
    {
      title: "个人简介",
      description: "了解我正在做的事",
      href: "/about",
      icon: "about" as const,
      color: "var(--about-accent)",
      bg: "rgba(91, 120, 166, 0.12)",
    },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-12 pt-2">
      <div className="ly-portal-shell page-rise">
        <section className="ly-portal-hero">
          <div className="ly-portal-hero-photo" />
          <div className="ly-portal-hero-wash" />

          <div className="relative z-10 grid min-h-[inherit] gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,0.72fr)] lg:items-center lg:px-16 xl:px-20">
            <div className="max-w-[46rem]">
              <h1 className="font-display text-[clamp(5.6rem,12.5vw,10rem)] font-black leading-[0.88] tracking-[-0.06em] text-[var(--foreground)]">
                AI 总站
              </h1>
              <p className="mt-8 max-w-2xl text-[clamp(1.35rem,2.2vw,2rem)] font-black leading-tight tracking-[-0.025em] text-slate-700">
                看 AI 日报，和模型一起工作。
              </p>
              <p className="mt-3 max-w-xl text-[0.98rem] font-medium leading-7 text-slate-500">
                日报、聊天室、项目推荐，集中在这里。
              </p>

              <div className="mt-8 flex w-fit flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <Link
                  href={latestDailyIssue ? `/daily/${latestDailyIssue.slug}` : "/daily"}
                  className="ly-primary-action inline-flex h-12 w-40 items-center justify-center gap-2.5 whitespace-nowrap px-6 py-3 text-[0.95rem] font-bold"
                >
                  <PortalIcon name="doc" className="h-5 w-5" />
                  进入 AI 日报
                </Link>
                <Link
                  href="/rooms"
                  className="ly-hero-secondary-action inline-flex h-12 w-40 items-center justify-center gap-2.5 whitespace-nowrap px-6 py-3 text-[0.95rem] font-bold"
                >
                  <PortalIcon name="chat" className="h-5 w-5" />
                  打开聊天室
                </Link>
              </div>
            </div>

            <Link
              href={latestDailyIssue ? `/daily/${latestDailyIssue.slug}` : "/daily"}
              className="ly-headline-card float-slow hidden w-full max-w-[31rem] justify-self-end p-7 transition hover:-translate-y-1 lg:mt-28 lg:block lg:self-start xl:mt-32"
            >
              <div className="flex items-center justify-between gap-4 text-[0.78rem] font-bold text-slate-500">
                <span>{latestDailyIssue?.issueDate?.replace(/-/g, ".") ?? "待发布"}</span>
                <ArrowIcon className="h-4 w-4" />
              </div>
              <h2 className="mt-4 font-display text-[2.15rem] font-black leading-tight tracking-[-0.03em] text-[var(--foreground)]">
                今日头版
              </h2>
              <p className="mt-3 text-[0.95rem] font-bold leading-7 text-slate-700">
                {latestDailyIssue?.title ?? "发布第一期 AI 日报后，这里会自动点亮。"}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[0.78rem] font-semibold text-slate-500">
                {latestDailyIssue ? (
                  <>
                    <span>{latestDailyIssue.itemCount} 条重点</span>
                    <span>·</span>
                    <span>{readMinutes} 分钟读完</span>
                  </>
                ) : (
                  <span>发布后自动更新</span>
                )}
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 px-1 sm:mt-6 sm:px-2 md:grid-cols-2 xl:grid-cols-4">
          {entries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="ly-entry-card group relative z-20"
              style={{ "--entry-accent": entry.color } as CSSProperties}
            >
              <span className="ly-entry-icon" style={{ color: entry.color, background: entry.bg }}>
                <PortalIcon name={entry.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-[1rem] font-extrabold tracking-tight text-[var(--foreground)]">
                  {entry.title}
                </span>
                <span className="mt-1 block truncate text-[0.78rem] font-semibold text-slate-500">
                  {entry.description}
                </span>
              </span>
              <ArrowIcon className="h-5 w-5 text-[color:var(--entry-accent)] opacity-45 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>
          ))}
        </section>

        <section className="mt-8 grid gap-5 px-1 sm:px-2 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:items-start">
          <div className="ly-surface-card overflow-hidden p-5 sm:p-6">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
                  今日判断
                </p>
                <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                  从最新一期开始看
                </h2>
              </div>
              <Link href="/daily/archive" className="text-[0.86rem] font-bold text-[var(--accent)] hover:underline">
                全部归档
              </Link>
            </div>

            {dailyIssues.length > 0 ? (
              <div className="grid gap-4">
                {latestDailyIssue ? (
                  <Link
                    href={`/daily/${latestDailyIssue.slug}`}
                    className="group rounded-[1.35rem] border border-[var(--accent)]/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(239,246,255,0.74))] p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/25 hover:bg-white sm:p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[0.78rem] font-bold text-slate-500">
                      <span>{latestDailyIssue.issueDate.replace(/-/g, ".")}</span>
                      <span>·</span>
                      <span>{latestDailyIssue.itemCount} 条重点</span>
                      {readMinutes ? (
                        <>
                          <span>·</span>
                          <span>{readMinutes} 分钟读完</span>
                        </>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-balance font-display text-2xl font-black leading-tight text-[var(--foreground)] transition group-hover:text-[var(--accent)] sm:text-[1.75rem]">
                      {latestDailyIssue.title}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
                      {getDailyIssueDek(latestDailyIssue)}
                    </p>
                  </Link>
                ) : null}

                <div className="grid gap-3">
                  {dailyIssues.slice(1, 4).map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/daily/${issue.slug}`}
                      className="ly-daily-issue-row grid gap-2 rounded-[1.05rem] px-3 py-3.5 transition sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <span className="font-mono text-[0.78rem] font-bold text-slate-400">
                        {issue.issueDate.slice(5).replace("-", ".")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.95rem] font-bold text-[var(--foreground)]">
                          {issue.title}
                        </span>
                        <span className="mt-1 block truncate text-[0.78rem] font-medium text-slate-500">
                          {getDailyIssueDek(issue)}
                        </span>
                      </span>
                      <span className="text-[0.78rem] font-bold text-slate-400">{issue.itemCount} 条</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.15rem] border border-dashed border-slate-300/70 bg-white/45 px-4 py-8 text-sm font-medium text-slate-500">
                还没有已发布日报。完成发布流程后，首页会自动展示最新内容。
              </div>
            )}
          </div>

          <div className="grid gap-5">
            <div className="ly-surface-card p-5 sm:p-6">
              <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
                运行状态
              </p>
              <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                站点速览
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "累计日报", value: dailyStats.publishedIssueCount },
                  { label: "累计条目", value: dailyStats.publishedItemCount },
                  { label: "启用模型", value: modelStats._count._all },
                  { label: "聊天房间", value: roomStats._count._all },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.05rem] bg-white/50 px-4 py-4">
                    <p className="font-display text-3xl font-black tracking-tight text-[var(--foreground)]">
                      {item.value}
                    </p>
                    <p className="mt-1 text-[0.78rem] font-bold text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {latestDailyItems.length > 0 ? (
              <div className="ly-surface-card p-5 sm:p-6">
                <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">今日焦点</p>
                <div className="mt-3 grid gap-2">
                  {latestDailyItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/daily/${latestDailyIssue?.slug}#item-${item.sortOrder}-${item.id}`}
                      className="text-[0.86rem] font-bold leading-6 text-slate-700 transition hover:text-[var(--accent)]"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ly-surface-card p-5 sm:p-6">
              <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--project-accent)]">
                后续扩展
              </p>
              <h2 className="mt-1 font-display text-xl font-black tracking-tight text-[var(--foreground)]">
                项目推荐与个人简介会继续沉淀
              </h2>
              <div className="mt-4 grid gap-2">
                <Link href="/projects" className="rounded-[1rem] bg-white/50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:text-[var(--project-accent)]">
                  查看项目推荐
                </Link>
                <Link href="/about" className="rounded-[1rem] bg-white/50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:text-[var(--about-accent)]">
                  查看个人简介
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
