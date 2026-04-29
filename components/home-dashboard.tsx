import Link from "next/link";

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
  const latestDailyItems = latestDailyIssue?.items?.slice(0, 2) ?? [];
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
      bg: "rgba(20, 184, 166, 0.11)",
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

          <div className="relative z-10 grid min-h-[inherit] gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,0.96fr)_minmax(300px,0.62fr)] lg:items-center lg:px-14">
            <div className="max-w-[38rem]">
              <div className="ly-hero-kicker mb-5">
                <span className="ly-live-dot" />
                <span>{modelStats._count._all} 个模型可用 · {roomStats._count._all} 个房间</span>
              </div>

              <h1 className="font-display text-[clamp(4.7rem,11vw,8rem)] font-black leading-[0.92] tracking-[-0.055em] text-[var(--foreground)]">
                AI 总站
              </h1>
              <p className="mt-7 text-[clamp(1.25rem,2.4vw,1.75rem)] font-bold leading-tight tracking-[-0.02em] text-slate-700">
                看 AI 日报，和模型一起工作。
              </p>
              <p className="mt-3 max-w-xl text-[0.98rem] font-medium leading-7 text-slate-500">
                日报、聊天室、项目推荐，集中在这里。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={latestDailyIssue ? `/daily/${latestDailyIssue.slug}` : "/daily"}
                  className="ly-primary-action inline-flex items-center gap-2.5 px-6 py-3 text-[0.95rem] font-bold"
                >
                  <PortalIcon name="doc" className="h-5 w-5" />
                  进入 AI 日报
                </Link>
                <Link
                  href="/rooms"
                  className="ly-secondary-action inline-flex min-h-12 items-center gap-2.5 px-6 py-3 text-[0.95rem] font-bold text-[var(--foreground)]"
                >
                  <PortalIcon name="chat" className="h-5 w-5" />
                  打开聊天室
                </Link>
              </div>
            </div>

            <Link
              href={latestDailyIssue ? `/daily/${latestDailyIssue.slug}` : "/daily"}
              className="ly-headline-card float-slow hidden p-5 transition hover:-translate-y-1 lg:block"
            >
              <div className="flex items-center justify-between gap-4 text-[0.78rem] font-bold text-slate-500">
                <span>{latestDailyIssue?.issueDate?.replace(/-/g, ".") ?? "待发布"}</span>
                <ArrowIcon className="h-4 w-4" />
              </div>
              <h2 className="mt-4 font-display text-[1.85rem] font-black leading-tight tracking-[-0.03em] text-[var(--foreground)]">
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
                  <span>连接日报后台后自动更新</span>
                )}
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-4 px-3 sm:mt-6 sm:px-7 md:grid-cols-2 xl:grid-cols-4">
          {entries.map((entry) => (
            <Link key={entry.href} href={entry.href} className="ly-entry-card group relative z-20">
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
              <ArrowIcon className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[var(--accent)]" />
            </Link>
          ))}
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.32fr)_minmax(320px,0.68fr)] lg:items-start">
          <div className="ly-surface-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
                  近期日报
                </p>
                <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                  近期日报
                </h2>
              </div>
              <Link href="/daily/archive" className="text-[0.86rem] font-bold text-[var(--accent)] hover:underline">
                全部归档
              </Link>
            </div>

            {dailyIssues.length > 0 ? (
              <div className="grid gap-3">
                {dailyIssues.slice(0, 3).map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/daily/${issue.slug}`}
                  className="hover-lift grid gap-2 rounded-[1.15rem] border border-white/60 bg-white/55 px-4 py-4 transition hover:bg-white sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="font-mono text-[0.78rem] font-bold text-slate-400">
                      {issue.issueDate.slice(5).replace("-", ".")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.95rem] font-bold text-[var(--foreground)]">
                        {issue.title}
                      </span>
                      {issue.summary ? (
                        <span className="mt-1 block truncate text-[0.78rem] font-medium text-slate-500">
                          {issue.summary}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[0.78rem] font-bold text-slate-400">{issue.itemCount} 条</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.15rem] border border-dashed border-slate-300/70 bg-white/45 px-4 py-8 text-sm font-medium text-slate-500">
                还没有已发布日报。运行日报后台发布流程后，首页会自动展示最新内容。
              </div>
            )}
          </div>

          <div className="ly-surface-card p-5 sm:p-6">
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
              站点速览
            </p>
            <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
              站点速览
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {[
                { label: "累计日报", value: dailyStats.publishedIssueCount },
                { label: "累计条目", value: dailyStats.publishedItemCount },
                { label: "启用模型", value: modelStats._count._all },
                { label: "聊天房间", value: roomStats._count._all },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.15rem] bg-white/50 px-4 py-4">
                  <p className="font-display text-3xl font-black tracking-tight text-[var(--foreground)]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[0.78rem] font-bold text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
            {latestDailyItems.length > 0 ? (
              <div className="mt-5 rounded-[1.15rem] bg-white/50 px-4 py-4">
                <p className="text-[0.78rem] font-extrabold text-slate-500">今日焦点</p>
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
          </div>
        </section>
      </div>
    </main>
  );
}
