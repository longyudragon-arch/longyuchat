import Link from "next/link";

const projectTracks = [
  {
    eyebrow: "01 / 工具",
    title: "开源工具",
    description: "优先记录能进入真实工作流的 AI 工具、MCP 服务、开发者组件和自动化脚本。",
    signals: ["能复用", "有维护", "可验证"],
  },
  {
    eyebrow: "02 / 案例",
    title: "应用案例",
    description: "拆解值得参考的 AI 产品形态，重点看交互、效率、交付成本和长期留存。",
    signals: ["场景清楚", "路径短", "有业务感"],
  },
  {
    eyebrow: "03 / 技术栈",
    title: "技术栈观察",
    description: "把 GitHub 项目、论文实现、模型能力和工程实践放在同一张地图里比较。",
    signals: ["可组合", "可迁移", "可扩展"],
  },
];

const evaluationRules = [
  "是否解决一个明确问题，而不是只展示模型能力。",
  "是否能被个人开发者或小团队低成本复用。",
  "是否有持续维护、清晰文档和可运行示例。",
  "是否能和 LongyuChat 的日报、聊天室或专题页产生连接。",
];

const roadmap = [
  {
    label: "第一步",
    title: "建立项目雷达",
    copy: "先用人工筛选沉淀标准，把项目入口、分类和推荐理由做清楚。",
  },
  {
    label: "第二步",
    title: "连接日报线索",
    copy: "从每日新闻中抽出值得追踪的工具、论文实现和产品案例。",
  },
  {
    label: "第三步",
    title: "形成专题推荐",
    copy: "围绕 MCP、Agent、RAG、本地推理等主题生成可回看的项目页。",
  },
];

export function ProjectsPage() {
  return (
    <main className="ly-page-wrap ly-page-projects">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.75rem] px-5 py-7 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.18),transparent_42%),linear-gradient(110deg,transparent,rgba(20,184,166,0.10))] lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--project-accent)]">
                项目雷达
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-[2.25rem] font-black leading-[1.05] text-[#0F1A2B] sm:text-[3.2rem] lg:text-[4rem]">
                筛出值得跟进的 AI 项目
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-8 text-slate-600 sm:text-base">
                这里不是项目黄页，而是长期观察清单。关注开源工具、产品案例和技术栈变化，帮助你更快判断什么值得试、值得学、值得合作。
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["开源工具", "应用案例", "技术栈观察", "专题推荐"].map((item) => (
                  <span key={item} className="rounded-full border border-emerald-500/15 bg-white/55 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.45rem] border border-white/65 bg-white/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--project-accent)]">
                当前状态
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-[#0F1A2B]">
                先搭结构，再接真实推荐流
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                后续可以接 GitHub 项目推荐、日报引用和专题页，把“看见趋势”和“找到项目”连起来。
              </p>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {projectTracks.map((track) => (
            <article key={track.title} className="ly-surface-card ly-surface-card-hover p-5 sm:p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--project-accent)]">
                {track.eyebrow}
              </p>
              <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                {track.title}
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                {track.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {track.signals.map((signal) => (
                  <span key={signal} className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-700">
                    {signal}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="ly-surface-card p-5 sm:p-6">
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--project-accent)]">
              筛选规则
            </p>
            <h2 className="mt-2 font-display text-3xl font-black leading-tight tracking-tight text-[var(--foreground)]">
              推荐不是收集链接，而是给出判断。
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-500">
              每个项目进入推荐前，至少要能回答“为什么现在值得看”和“它能放进什么工作流”。
            </p>
          </div>

          <div className="ly-surface-card p-5 sm:p-6">
            <div className="grid gap-3">
              {evaluationRules.map((rule, index) => (
                <div key={rule} className="grid gap-3 rounded-[1.15rem] bg-white/50 px-4 py-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:items-start">
                  <p className="font-mono text-sm font-black text-[var(--project-accent)]">
                    0{index + 1}
                  </p>
                  <p className="text-sm font-semibold leading-7 text-slate-600">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ly-surface-card p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--project-accent)]">
                推进路线
              </p>
              <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                从入口到项目知识库
              </h2>
            </div>
            <Link href="/daily" className="text-sm font-black text-[var(--project-accent)] transition hover:underline">
              从日报发现线索
            </Link>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {roadmap.map((step) => (
              <article key={step.title} className="rounded-[1.25rem] border border-white/60 bg-white/45 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--project-accent)]">
                  {step.label}
                </p>
                <h3 className="mt-2 text-lg font-black text-[#0F1A2B]">{step.title}</h3>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-500">{step.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
