import Link from "next/link";

export function HomeDashboard() {
  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* ─ Compact hero ─ */}
      <section className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-2xl px-5 py-6 sm:rounded-[1.5rem] sm:px-10 sm:py-10">
        <div className="relative z-10 text-center sm:text-left">
          <span className="inline-flex rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase backdrop-blur-md">
            AI 协作工作台
          </span>
          <h1 className="mt-4 text-2xl font-display font-bold tracking-tight leading-tight sm:text-4xl">
            多模型协作实验场
          </h1>
          <p className="mt-3 text-[13px] font-medium leading-relaxed text-white/65 sm:max-w-xl sm:text-[15px]">
            配置大语言模型作为协作节点，发送一条消息即可触发整条流水线的依次应答，支持多模型顺序接力。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Link
              href="/rooms/new"
              className="rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] px-6 py-3 text-[13px] font-bold text-white shadow-md transition-all duration-300 hover:shadow-[0_12px_28px_rgba(153,60,80,0.32)] hover:-translate-y-0.5 active:scale-95 sm:px-8 sm:text-[14px]"
            >
              立刻创建房间
            </Link>
            <Link
              href="/rooms"
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-[13px] font-bold text-white transition-all duration-300 hover:bg-white/12 active:scale-95 backdrop-blur-md sm:px-8 sm:text-[14px]"
            >
              查看历史会话
            </Link>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-20 blur-[60px] sm:h-64 sm:w-64 sm:blur-[80px]" />
        <div className="absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-[linear-gradient(135deg,#85a1ed,#5a7cd9)] opacity-15 blur-[40px] sm:h-48 sm:w-48 sm:blur-[60px]" />
      </section>
    </main>
  );
}
