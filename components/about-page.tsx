import Link from "next/link";

const profilePoints = [
  {
    label: "关注方向",
    title: "AI 应用落地",
    copy: "关注模型能力如何进入真实工具链，而不是停在演示效果。",
  },
  {
    label: "整理方法",
    title: "信息整理",
    copy: "用日报、项目推荐和专题页，把分散的 AI 变化整理成可回看的判断。",
  },
  {
    label: "正在建设",
    title: "个人产品",
    copy: "LongyuChat 是一个长期打磨的个人 AI 总站，也是一套持续演化的工作台。",
  },
];

const collaborationSignals = [
  "AI 产品原型与落地讨论",
  "模型协作工作流设计",
  "内容站、专题页与信息整理",
  "开源项目观察与推荐",
];

const operatingNotes = [
  "白天收集信息，晚上复盘和写作。",
  "偏好小步验证，不追求一次性做成大系统。",
  "如果一个工具不能进入日常工作流，就先不把它写进推荐。",
];

export function AboutPage() {
  return (
    <main className="ly-page-wrap ly-page-about">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass relative overflow-hidden rounded-[1.75rem] px-5 py-7 sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_80%_15%,rgba(91,120,166,0.20),transparent_44%),linear-gradient(115deg,transparent,rgba(184,106,199,0.08))] lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--about-accent)]">
                重庆 / 长期观察
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-[2.25rem] font-black leading-[1.05] text-[#0F1A2B] sm:text-[3.2rem] lg:text-[4rem]">
                在重庆整理 AI 的信息流和工具流
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-8 text-slate-600 sm:text-base">
                这里放的是我正在做的事：看 AI 变化、试模型协作、记录值得长期关注的项目。个人介绍保持克制，把更多空间留给作品和判断。
              </p>
            </div>

            <aside className="rounded-[1.45rem] border border-white/65 bg-white/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--about-accent)]">
                适合联系我的事
              </p>
              <div className="mt-4 grid gap-2">
                {collaborationSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-slate-300/50 bg-white/55 px-3 py-2 text-xs font-black text-slate-600">
                    {signal}
                  </span>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {profilePoints.map((point) => (
            <article key={point.title} className="ly-surface-card ly-surface-card-hover p-5 sm:p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--about-accent)]">
                {point.label}
              </p>
              <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                {point.title}
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                {point.copy}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="ly-surface-card p-5 sm:p-6">
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--about-accent)]">
              工作方式
            </p>
            <h2 className="mt-2 font-display text-3xl font-black leading-tight tracking-tight text-[var(--foreground)]">
              少写自我介绍，多展示可验证的输出。
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-500">
              首页负责清爽进入，个人简介只解释“为什么这些模块放在一起”。真正的能力证明，会逐渐沉淀在日报、聊天室和项目推荐里。
            </p>
          </div>

          <div className="ly-surface-card p-5 sm:p-6">
            <div className="grid gap-3">
              {operatingNotes.map((note, index) => (
                <div key={note} className="grid gap-3 rounded-[1.15rem] bg-white/50 px-4 py-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:items-start">
                  <p className="font-mono text-sm font-black text-[var(--about-accent)]">
                    0{index + 1}
                  </p>
                  <p className="text-sm font-semibold leading-7 text-slate-600">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ly-surface-card p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--about-accent)]">
                下一步
              </p>
              <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                下一步会把作品和项目页接进来
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-500">
                个人页后续更适合承接简历、GitHub 项目推荐、专题页和合作入口，而不是堆满个人履历。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/projects" className="ly-primary-action inline-flex px-5 py-3 text-sm font-bold">
                看项目推荐
              </Link>
              <Link href="/daily" className="ly-secondary-action inline-flex px-5 py-3 text-sm font-bold text-[#0F1A2B]">
                看 AI 日报
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
