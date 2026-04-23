import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getDailyIssueStats, listPublishedDailyIssues } from "@/server/services/daily-issue-service";

export async function HomeDashboard() {
  const [latestDailyIssue, dailyStats, modelStats, roomStats] = await Promise.all([
    listPublishedDailyIssues(1).then((issues) => issues[0] ?? null),
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

  const latestDailyItems = latestDailyIssue?.items?.slice(0, 3) ?? [];

  return (
    <main className="ly-page-wrap min-h-[calc(100vh-4rem)]">
      <div className="ly-shell flex min-h-[calc(100vh-6rem)] flex-col gap-8 pb-8">
        <section className="ly-glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10 xl:p-12">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] opacity-60">
            <div className="h-full w-full bg-gradient-to-bl from-[#FF8DA1]/45 via-[#f4b6d8]/28 to-transparent blur-[120px]" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/20 to-transparent" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.16fr)_minmax(330px,0.84fr)] xl:items-start">
            <div className="space-y-7">
              <div className="max-w-[60rem]">
                <div className="mb-6 flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full bg-[#FF8DA1]/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#DC75A5]">
                    AI Portal
                  </span>
                  <span className="text-xs text-stone-400">•</span>
                  <span className="text-xs font-medium text-stone-500">自动日报 + 多模型协作 + 持续扩展中的个人 AI 总站</span>
                </div>

                <h1 className="mb-4 max-w-[56rem] text-[2.25rem] font-display font-bold tracking-[-0.05em] text-[#4b3a46] sm:text-[2.8rem] lg:text-[3.15rem]">
                  LongyuChat
                  <br />
                  一个会持续生长的 AI 总站
                </h1>
                <p className="max-w-[50rem] text-[1rem] leading-8 text-stone-600 sm:text-[1.08rem]">
                  这里不只是一个聊天工具页面。它同时承载自动生成的 AI 日报、多模型协作实验场，以及后续会持续补齐的个人简历、GitHub 项目推荐与专题内容模块。
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:max-w-[56rem]">
                <div className="rounded-[1.45rem] bg-white/55 px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">内容引擎</p>
                  <p className="mt-2 text-[15px] font-bold text-[#2f2e33]">AI 日报</p>
                  <p className="mt-1 text-sm leading-7 text-stone-600">
                    自动抓取、筛选、归档 AI 领域重要动态，形成可持续回访的内容入口。
                  </p>
                </div>
                <div className="rounded-[1.45rem] bg-white/55 px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#DC75A5]">工具引擎</p>
                  <p className="mt-2 text-[15px] font-bold text-[#2f2e33]">多模型聊天室</p>
                  <p className="mt-1 text-sm leading-7 text-stone-600">
                    通过顺序协作链排演多个模型的应答过程，适合实验、对比和复用工作流。
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href={latestDailyIssue ? `/daily/${latestDailyIssue.slug}` : "/daily"}
                  className="ly-primary-action group inline-flex min-h-12 items-center gap-3 px-8 py-4 font-bold"
                >
                  进入 AI 日报
                  <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <Link
                  href="/rooms/new"
                  className="ly-secondary-action inline-flex min-h-12 items-center px-8 py-4 font-bold text-[#2f2e33] active:scale-95"
                >
                  打开聊天实验场
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="ly-surface-card rounded-[1.6rem] p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#DC75A5]">今日头版</p>
                  <span className="rounded-full bg-[#FF8DA1]/15 px-2.5 py-1 text-[10px] font-bold text-[#DC75A5]">自动更新</span>
                </div>

                {latestDailyIssue ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">{latestDailyIssue.issueDate}</p>
                      <h2 className="mt-2 text-[1.45rem] font-display font-bold tracking-[-0.03em] text-[#2f2e33]">
                        <Link href={`/daily/${latestDailyIssue.slug}`} className="hover:text-[#DC75A5]">
                          {latestDailyIssue.title}
                        </Link>
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-stone-600">
                        {latestDailyIssue.summary ?? "最新一期 AI 日报已经生成。"}
                      </p>
                    </div>

                    <div className="grid gap-3">
                      {latestDailyItems.map((item, index) => (
                        <Link
                          key={item.id}
                          href={`/daily/${latestDailyIssue.slug}#item-${item.sortOrder}-${item.id}`}
                          className="rounded-[1.2rem] bg-white/55 px-4 py-3 transition hover:bg-white"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">0{index + 1}</p>
                          <p className="mt-1 text-sm font-bold leading-6 text-[#2f2e33]">{item.title}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.2rem] bg-white/55 px-4 py-5 text-sm leading-7 text-stone-500">
                    还没有已发布的 AI 日报。去日报后台导入来源并运行扫描/发布后，这里会自动显示最新一期。
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="ly-surface-card p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#DC75A5]">站点概览</p>
                    <span className="text-[11px] font-semibold text-stone-400">动态统计</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    <div className="rounded-2xl bg-white/45 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">累计日报</p>
                      <p className="mt-2 text-2xl font-display font-bold tracking-tight text-[#2f2e33]">{dailyStats.publishedIssueCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white/45 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">累计条目</p>
                      <p className="mt-2 text-2xl font-display font-bold tracking-tight text-[#2f2e33]">{dailyStats.publishedItemCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white/45 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">启用模型</p>
                      <p className="mt-2 text-2xl font-display font-bold tracking-tight text-[#2f2e33]">{modelStats._count._all}</p>
                    </div>
                    <div className="rounded-2xl bg-white/45 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">房间总数</p>
                      <p className="mt-2 text-2xl font-display font-bold tracking-tight text-[#2f2e33]">{roomStats._count._all}</p>
                    </div>
                  </div>
                </div>

                <div className="ly-surface-card p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#DC75A5]">即将上线</p>
                    <span className="text-[11px] font-semibold text-stone-400">门户扩展</span>
                  </div>
                  <div className="grid gap-3">
                    {[
                      { title: "个人简历", description: "用招聘导向的方式展示经历、方向和能力地图。" },
                      { title: "GitHub 项目推荐", description: "精选项目、项目拆解与持续更新的作品展示区。" },
                      { title: "专题页", description: "围绕模型、工具链或 AI 产品做纵深内容聚合。" },
                    ].map((item) => (
                      <div key={item.title} className="rounded-[1.2rem] bg-white/45 px-4 py-3">
                        <p className="font-bold text-[#2f2e33]">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-stone-500">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="space-y-6">
            <h3 className="flex items-center gap-3 px-2 text-2xl font-bold text-[#DC75A5]">
              <span className="h-6 w-1.5 rounded-full bg-[#DC75A5]" />
              门户入口
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              <Link href="/daily" className="ly-surface-card ly-surface-card-hover block p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl bg-[#FF8DA1]/10 p-3">
                    <svg className="h-6 w-6 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6h13M9 5v6h13M3 5h.01M3 11h.01M3 17h.01" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Content</span>
                </div>
                <h4 className="mb-2 text-lg font-bold text-[#2f2e33]">AI 日报</h4>
                <p className="text-sm leading-relaxed text-stone-500">
                  浏览最新一期、查询历史归档、订阅 RSS，并从你的视角持续跟踪 AI 行业变化。
                </p>
              </Link>

              <Link href="/rooms/new" className="ly-surface-card ly-surface-card-hover block p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <svg className="h-6 w-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Tool</span>
                </div>
                <h4 className="mb-2 text-lg font-bold text-[#2f2e33]">AI 聊天室</h4>
                <p className="text-sm leading-relaxed text-stone-500">
                  进入多模型顺序协作实验场，创建房间、排演流程、对比不同模型在同一任务上的表现。
                </p>
              </Link>

              <Link href="/models" className="ly-surface-card ly-surface-card-hover block p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl bg-[#FF8DA1]/10 p-3">
                    <svg className="h-6 w-6 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104h4.5a1.5 1.5 0 011.5 1.5V6h1.646a1.5 1.5 0 011.06.44l1.104 1.103a1.5 1.5 0 01.44 1.061V12h-2.25M4.5 12V8.604a1.5 1.5 0 01.44-1.06l1.103-1.104A1.5 1.5 0 017.104 6H8.75V4.604a1.5 1.5 0 011.5-1.5zM6 15.75h12M7.5 18.75h9" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Infra</span>
                </div>
                <h4 className="mb-2 text-lg font-bold text-[#2f2e33]">模型管理</h4>
                <p className="text-sm leading-relaxed text-stone-500">
                  统一维护大模型连接、默认回复长度和可用状态，为日报和聊天功能提供底层能力。
                </p>
              </Link>

              <Link href="/daily/archive" className="ly-surface-card ly-surface-card-hover block p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <svg className="h-6 w-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 5h5m-7 8h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Archive</span>
                </div>
                <h4 className="mb-2 text-lg font-bold text-[#2f2e33]">日报归档</h4>
                <p className="text-sm leading-relaxed text-stone-500">
                  通过日期和关键词查询过往日报，回看某一天你筛选过的 AI 变化与判断。
                </p>
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="flex items-center gap-3 px-2 text-2xl font-bold text-[#DC75A5]">
              <span className="h-6 w-1.5 rounded-full bg-[#DC75A5]" />
              为什么回来
            </h3>

            <div className="ly-surface-card h-full p-6">
              <div className="grid gap-4">
                {[
                  { title: "每天一屏看到重点", description: "最新日报会优先出现在首页右侧与日报模块中，减少“今天该看什么”的成本。" },
                  { title: "既能读内容，也能直接动手", description: "看完日报后可以立刻进入聊天室做实验或追问，把内容和工具串成一条链。" },
                  { title: "适合招聘与合作展示", description: "首页既有数据积累，也有内容产出和工具入口，更像完整的个人 AI 门户而不是单功能 demo。" },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.35rem] bg-white/45 px-4 py-4">
                    <p className="font-bold text-[#2f2e33]">{item.title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-stone-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
