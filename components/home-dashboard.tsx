import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";

const actionCards = [
  {
    href: "/models",
    eyebrow: "步骤 01",
    title: "配置模型",
    body: "录入 Provider、模型 ID、默认回复字数和连接状态，后续所有房间直接复用。",
    cta: "去模型管理",
  },
  {
    href: "/rooms/new",
    eyebrow: "步骤 02",
    title: "创建房间",
    body: "选择参与模型，拖拽排好回复顺序，立即生成新的协作房间。",
    cta: "去新建房间",
  },
  {
    href: "/rooms",
    eyebrow: "步骤 03",
    title: "继续聊天",
    body: "回到历史房间，查看最近消息、参与模型和当前协作状态。",
    cta: "去房间列表",
  },
];

const experienceCards = [
  {
    eyebrow: "聊天体验",
    title: "看到真实的顺序协作过程",
    body: "用户消息发出后，AI 不会等全部完成才一起出现，而是会按顺序逐条回答，并配合时间线告诉你当前轮到谁。",
  },
  {
    eyebrow: "结果可靠",
    title: "失败也不会把已经完成的内容抹掉",
    body: "如果某个模型中途失败，前面已经成功的回复会被保留，页面也会明确告诉你是部分完成还是全部完成。",
  },
];

const quickFacts = [
  { label: "单聊与群聊", value: "都能创建" },
  { label: "顺序回复", value: "依次落库渲染" },
  { label: "聊天历史", value: "刷新后仍保留" },
];

export function HomeDashboard() {
  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* Mobile Hero (only visible on small screens) */}
      <section className="grid gap-4 lg:hidden">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.5rem] px-6 py-10 shadow-2xl">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.24em] text-white/90 uppercase backdrop-blur-md">
              AI 协作工作台
            </span>
            <h1 className="mt-6 text-3xl font-display font-bold tracking-tight leading-[1.15]">
              把多个 AI <br />
              放进同一间房
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/80 font-medium">
              这里保留了最核心的协作能力：录入模型、定义顺序、即时对话。
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <Link
                href="/rooms/new"
                className="rounded-[1.25rem] bg-white/95 px-4 py-4 text-center text-[15px] font-bold text-[#2b2a30] transition-all duration-300 hover:bg-white active:scale-95 shadow-[0_8px_24px_rgba(255,255,255,0.15)]"
              >
                新建房间
              </Link>
              <Link
                href="/rooms"
                className="rounded-[1.25rem] border border-white/20 bg-white/5 px-4 py-4 text-center text-[15px] font-bold text-white transition-all duration-300 hover:bg-white/15 active:scale-95 backdrop-blur-md"
              >
                继续聊天
              </Link>
            </div>
          </div>
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] opacity-30 blur-[60px]" />
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-[linear-gradient(135deg,#85a1ed,#5a7cd9)] opacity-20 blur-[50px]" />
        </div>

        <div className="ly-glass rounded-[2.5rem] p-6 shadow-xl shadow-[var(--accent)]/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">立即开始</p>
              </div>
              <h2 className="mt-3 text-2xl font-display font-bold tracking-tight text-[var(--foreground)]">引导三步走</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {actionCards.map((card, index) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative rounded-[1.75rem] border border-white/40 bg-white/30 px-6 py-6 transition-all duration-500 hover:bg-white/50 hover:shadow-xl hover:shadow-[var(--accent)]/10 hover:-translate-y-1 active:scale-[0.98] backdrop-blur-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-60 uppercase">步骤 0{index + 1}</span>
                  <span className="text-[12px] font-bold text-[var(--accent)] opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">{card.cta} →</span>
                </div>
                <h3 className="mt-3 text-xl font-display font-bold tracking-tight text-[var(--foreground)]">{card.title}</h3>
                <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--muted)]">{card.body}</p>
              </Link>
            ))}
          </div>
        </div>

        <LocalTestLauncher />
      </section>

      {/* Desktop Layout */}
      <section className="hidden gap-8 lg:grid xl:grid-cols-[1.15fr_0.85fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[3.5rem] px-12 py-16 flex flex-col justify-center shadow-[0_32px_80px_rgba(20,19,22,0.4)]">
          <div className="relative z-10 animate-fade-in-up">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold tracking-[0.24em] text-white/90 uppercase backdrop-blur-md shadow-inner">
              协作首页
            </span>
            <h1 className="mt-8 text-6xl font-display font-bold tracking-tight sm:text-7xl xl:text-[5rem] xl:leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/60">
              多模型顺序协作 <br />
              <span className="text-white/40 font-light">极简实验场</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[1.125rem] font-medium leading-[1.8] text-white/70">
              首页带你直达核心：先配置模型入口，再按需编排协作流水线。
              发送一条消息，即可见证多个 AI 按照你的意志依次作答。
            </p>

            <div className="mt-12 flex flex-wrap gap-5">
              <Link
                href="/rooms/new"
                className="rounded-full bg-white/95 px-9 py-4.5 text-[1.0625rem] font-bold text-[#2b2a30] transition-all duration-500 hover:bg-white hover:shadow-[0_16px_40px_rgba(255,255,255,0.2)] hover:-translate-y-1 active:scale-95"
              >
                立即创建房间
              </Link>
              <Link
                href="/rooms"
                className="rounded-full border border-white/20 bg-white/5 px-9 py-4.5 text-[1.0625rem] font-bold text-white transition-all duration-500 hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 active:scale-95 backdrop-blur-md"
              >
                查看历史记录
              </Link>
            </div>

            <div className="mt-16 grid gap-5 sm:grid-cols-3">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 transition-all duration-500 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm group"
                >
                  <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase group-hover:text-white/60 transition-colors">{fact.label}</p>
                  <p className="mt-3 text-[1.35rem] font-display font-bold text-white/90">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-15 blur-[120px] animate-pulse-slow" />
          <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-[linear-gradient(135deg,#85a1ed,#5a7cd9)] opacity-15 blur-[100px]" />
        </div>

        <aside className="ly-glass flex flex-col rounded-[3.5rem] p-10 xl:p-12 shadow-2xl shadow-[var(--accent)]/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">快速导航</p>
              </div>
              <h2 className="mt-5 text-4xl font-display font-bold tracking-tight text-[var(--foreground)]">开始你的实验</h2>
            </div>
            <span className="rounded-full bg-[var(--foreground)]/5 px-4 py-2 text-[12px] font-bold text-[var(--muted)] border border-[var(--border)]">
              入门引导
            </span>
          </div>

          <div className="mt-12 grid flex-1 gap-6">
            {actionCards.map((card, index) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative flex flex-col rounded-[2.5rem] border border-white/50 bg-white/30 px-8 py-7 transition-all duration-500 hover:bg-white/60 hover:border-white/80 hover:shadow-[0_24px_64px_rgba(153,60,80,0.08)] hover:-translate-y-1.5 active:scale-[0.98] backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-[0.25em] text-[var(--muted)] opacity-50 uppercase">步骤 0{index + 1}</span>
                  <span className="text-[13px] font-bold text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1">{card.cta} →</span>
                </div>
                <h3 className="mt-4 text-[1.65rem] font-display font-bold tracking-tight text-[var(--foreground)]">{card.title}</h3>
                <p className="mt-3 text-[14px] font-medium leading-relaxed text-[var(--muted)] opacity-90">{card.body}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6 sm:gap-8 sm:grid-cols-2">
          {experienceCards.map((card) => (
            <article key={card.title} className="ly-glass rounded-[3rem] p-8 sm:p-10 flex flex-col justify-between transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--accent)]/5 hover:-translate-y-1">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">{card.eyebrow}</p>
                <h2 className="mt-5 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">{card.title}</h2>
                <p className="mt-5 text-[15px] font-medium leading-relaxed text-[var(--muted)] opacity-90">{card.body}</p>
              </div>
              <div className="mt-10 h-1.5 w-16 rounded-full bg-[linear-gradient(90deg,var(--accent),transparent)] opacity-50" />
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-6 lg:gap-8">
          <div className="hidden lg:block">
            <LocalTestLauncher />
          </div>

          <section className="ly-glass rounded-[3rem] p-8 sm:p-10 transition-all duration-500 hover:shadow-2xl hover:shadow-[var(--accent)]/5">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">使用建议</p>
            </div>
            <h2 className="mt-5 text-3xl font-display font-bold tracking-tight text-[var(--foreground)]">新手配置清单</h2>
            <div className="mt-10 space-y-4">
              <div className="group flex items-start gap-5 rounded-[2rem] border border-white/40 bg-white/30 p-5 transition-all duration-300 hover:bg-white/60 hover:border-white/60 hover:shadow-lg backdrop-blur-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] text-[12px] font-bold text-white shadow-md shadow-[var(--accent)]/30 group-hover:scale-110 transition-transform">1</span>
                <p className="text-[15px] font-medium leading-relaxed text-[var(--foreground)] pt-0.5">先在「模型管理」录入至少 2 个已开启连接测试的模型。</p>
              </div>
              <div className="group flex items-start gap-5 rounded-[2rem] border border-white/40 bg-white/30 p-5 transition-all duration-300 hover:bg-white/60 hover:border-white/60 hover:shadow-lg backdrop-blur-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] text-[12px] font-bold text-white shadow-md shadow-[var(--accent)]/30 group-hover:scale-110 transition-transform">2</span>
                <p className="text-[15px] font-medium leading-relaxed text-[var(--foreground)] pt-0.5">去「新建房间」挑选这 2 个模型，并拖动排列顺序。</p>
              </div>
              <div className="group flex items-start gap-5 rounded-[2rem] border border-white/40 bg-white/30 p-5 transition-all duration-300 hover:bg-white/60 hover:border-white/60 hover:shadow-lg backdrop-blur-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] text-[12px] font-bold text-white shadow-md shadow-[var(--accent)]/30 group-hover:scale-110 transition-transform">3</span>
                <p className="text-[15px] font-medium leading-relaxed text-[var(--foreground)] pt-0.5">进入聊天，发送一条指令，看模型如何串联接力回答。</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
