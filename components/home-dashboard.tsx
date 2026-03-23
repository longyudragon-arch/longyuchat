import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";

const steps = [
  {
    href: "/models",
    number: "01",
    title: "配置模型",
    body: "录入 Provider、模型 ID、API Key 和默认回复字数。",
    cta: "去模型管理 →",
  },
  {
    href: "/rooms/new",
    number: "02",
    title: "创建房间",
    body: "选择参与模型，拖拽排好回复顺序，生成协作房间。",
    cta: "去新建房间 →",
  },
  {
    href: "/rooms",
    number: "03",
    title: "开始聊天",
    body: "进入房间，发送消息，看模型按顺序依次回答。",
    cta: "去房间列表 →",
  },
];

const highlights = [
  {
    title: "实时顺序回复",
    body: "消息发出后，AI 按顺序逐条回答，配合指示器告诉你当前轮到谁。",
  },
  {
    title: "容错不丢数据",
    body: "某个模型失败时，已成功的回复会留存，页面明确告知部分完成状态。",
  },
  {
    title: "灵活编排",
    body: "支持单聊和群聊，拖拽排列模型顺序，随时调整协作流水线。",
  },
];

export function HomeDashboard() {
  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* ─ Hero ─ */}
      <section className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.2rem] px-5 py-8 shadow-2xl sm:rounded-[3rem] sm:px-12 sm:py-14">
        <div className="relative z-10">
          <span className="inline-flex rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[10px] font-bold tracking-[0.22em] text-white/80 uppercase backdrop-blur-md sm:text-[11px]">
            AI 协作工作台
          </span>
          <h1 className="mt-5 text-[2rem] font-display font-bold tracking-tight leading-[1.12] sm:mt-8 sm:text-5xl xl:text-6xl">
            多模型顺序协作
            <br />
            <span className="text-white/40 font-light">极简实验场</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] font-medium leading-relaxed text-white/70 sm:mt-6 sm:text-[16px] sm:leading-[1.8]">
            配置模型入口，编排协作流水线，发送一条消息即可见证多个 AI 依次作答。
          </p>

          <div className="mt-7 flex flex-wrap gap-3 sm:mt-10">
            <Link
              href="/rooms/new"
              className="rounded-full bg-white/95 px-6 py-3 text-[14px] font-bold text-[#2b2a30] transition-all duration-300 hover:bg-white hover:shadow-[0_12px_32px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:scale-95 sm:px-8 sm:py-3.5 sm:text-[15px]"
            >
              立即创建房间
            </Link>
            <Link
              href="/rooms"
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-[14px] font-bold text-white transition-all duration-300 hover:bg-white/12 active:scale-95 backdrop-blur-md sm:px-8 sm:py-3.5 sm:text-[15px]"
            >
              查看历史记录
            </Link>
          </div>
        </div>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-20 blur-[80px] sm:h-[28rem] sm:w-[28rem] sm:blur-[120px]" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-[linear-gradient(135deg,#85a1ed,#5a7cd9)] opacity-15 blur-[60px] sm:h-72 sm:w-72 sm:blur-[100px]" />
      </section>

      {/* ─ Steps ─ */}
      <section className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="group ly-glass flex flex-col rounded-[1.8rem] px-5 py-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--accent)]/8 active:scale-[0.98] sm:rounded-[2.2rem] sm:px-7 sm:py-7"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] text-[12px] font-bold text-white shadow-md shadow-[var(--accent)]/25">
                {step.number}
              </span>
              <span className="text-[12px] font-bold text-[var(--accent)] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
                {step.cta}
              </span>
            </div>
            <h3 className="mt-4 text-[1.1rem] font-display font-bold tracking-tight sm:text-[1.3rem]">{step.title}</h3>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--muted)] sm:text-[14px]">{step.body}</p>
          </Link>
        ))}
      </section>

      {/* ─ Highlights ─ */}
      <section className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {highlights.map((item) => (
          <article key={item.title} className="ly-glass rounded-[1.8rem] px-5 py-5 transition-all duration-500 hover:shadow-xl hover:shadow-[var(--accent)]/5 sm:rounded-[2.2rem] sm:px-7 sm:py-7">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
              <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--accent)] uppercase">{item.title}</p>
            </div>
            <p className="mt-3 text-[13px] font-medium leading-relaxed text-[var(--muted)] sm:text-[14px]">{item.body}</p>
          </article>
        ))}
      </section>

      {/* ─ Local test launcher ─ */}
      <LocalTestLauncher />
    </main>
  );
}
