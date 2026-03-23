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
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      {/* Mobile Hero (only visible on small screens) */}
      <section className="grid gap-4 lg:hidden">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-6 py-8">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.24em] text-white/80 uppercase">
              AI 协作工作台
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight leading-tight">
              把多个 AI <br />
              放进同一间房
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              这里保留了最核心的协作能力：录入模型、定义顺序、即时对话。
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Link
                href="/rooms/new"
                className="rounded-2xl bg-white px-4 py-4 text-center text-sm font-bold text-[var(--foreground)] transition active:scale-95 shadow-lg shadow-black/10"
              >
                新建房间
              </Link>
              <Link
                href="/rooms"
                className="rounded-2xl border border-white/14 bg-white/10 px-4 py-4 text-center text-sm font-bold text-white transition active:scale-95"
              >
                继续聊天
              </Link>
            </div>
          </div>
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[var(--accent)] opacity-20 blur-[60px]" />
        </div>

        <div className="ly-glass rounded-[2.6rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">立即开始</p>
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">引导三步走</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {actionCards.map((card, index) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative rounded-[2rem] border border-[var(--border)] bg-white/80 px-5 py-5 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-40 uppercase">STEP 0{index + 1}</span>
                  <span className="text-[11px] font-bold text-[var(--accent)]">{card.cta} 鈫</span>
                </div>
                <h3 className="mt-2 text-lg font-bold tracking-tight text-[var(--foreground)]">{card.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)] opacity-80">{card.body}</p>
              </Link>
            ))}
          </div>
        </div>

        <LocalTestLauncher />
      </section>

      {/* Desktop Layout */}
      <section className="hidden gap-6 lg:grid xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[3rem] px-10 py-12 flex flex-col justify-center">
          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.24em] text-white/80 uppercase">
              Productivity Redefined
            </span>
            <h1 className="mt-8 text-5xl font-bold tracking-tight sm:text-6xl xl:text-7xl xl:leading-[1.05]">
              多模型顺序协作 <br />
              <span className="text-white/50">极简实验场</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70">
              首页带你直达核心：先配置模型入口，再按需编排协作流水线。
              发送一条消息，即可见证多个 AI 按照你的意志依次作答。
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/rooms/new"
                className="rounded-full bg-white px-8 py-4 text-base font-bold text-[var(--foreground)] transition hover:bg-[#fff4ea] hover:shadow-xl active:scale-95 shadow-lg shadow-black/10"
              >
                立即创建房间
              </Link>
              <Link
                href="/rooms"
                className="rounded-full border border-white/14 bg-white/10 px-8 py-4 text-base font-bold text-white transition hover:bg-white/15 active:scale-95"
              >
                查看历史记录
              </Link>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/8"
                >
                  <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">{fact.label}</p>
                  <p className="mt-2 text-xl font-bold text-white/90">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500 opacity-10 blur-[120px]" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500 opacity-5 blur-[80px]" />
        </div>

        <aside className="ly-glass flex flex-col rounded-[3rem] p-8 xl:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">快速导航</p>
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">从这里开始你的实验</h2>
            </div>
            <span className="rounded-full bg-black/5 px-4 py-2 text-[11px] font-bold text-[var(--muted)]">
              入门引导
            </span>
          </div>

          <div className="mt-10 grid flex-1 gap-5">
            {actionCards.map((card, index) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative flex flex-col rounded-[2.2rem] border border-[var(--border)] bg-white/84 px-7 py-6 transition-all hover:border-[var(--accent)] hover:shadow-2xl hover:shadow-[var(--accent)]/10 hover:-translate-y-1 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-[0.25em] text-[var(--muted)] opacity-30 uppercase">Task 0{index + 1}</span>
                  <span className="text-xs font-bold text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">{card.cta} 鈫</span>
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] opacity-80">{card.body}</p>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6 sm:grid-cols-2">
          {experienceCards.map((card) => (
            <article key={card.title} className="ly-glass rounded-[2.6rem] p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">{card.eyebrow}</p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight">{card.title}</h2>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)] opacity-90">{card.body}</p>
              </div>
              <div className="mt-8 h-1 w-12 rounded-full bg-[var(--border)]" />
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="hidden lg:block">
            <LocalTestLauncher />
          </div>

          <section className="ly-glass rounded-[2.6rem] p-7 sm:p-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--accent-strong)] uppercase">使用建议</p>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">新手配置 Checklist</h2>
            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-white/60 p-4 transition-colors hover:bg-white/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">1</span>
                <p className="text-sm font-medium leading-relaxed">先在「模型管理」录入至少 2 个已开启连接测试的模型。</p>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-white/60 p-4 transition-colors hover:bg-white/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">2</span>
                <p className="text-sm font-medium leading-relaxed">去「新建房间」挑选这 2 个模型，并拖动排列顺序。</p>
              </div>
              <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-white/60 p-4 transition-colors hover:bg-white/80">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[10px] font-bold text-[var(--accent)]">3</span>
                <p className="text-sm font-medium leading-relaxed">进入聊天，发送一条指令，看模型如何串联接力回答。</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
