import Link from "next/link";

const quickLinks = [
  {
    href: "/models",
    icon: "⚙",
    title: "模型配置",
    desc: "录入 Provider、API Key，管理你的模型基础设施。",
    cta: "进入 →",
    accent: "from-sky-400/80 to-sky-600/80",
  },
  {
    href: "/rooms/new",
    icon: "＋",
    title: "新建房间",
    desc: "挑选模型，定义回答顺序，创建协作聊天房间。",
    cta: "创建 →",
    accent: "from-[#f48498] to-[#993c50]",
  },
  {
    href: "/rooms",
    icon: "💬",
    title: "历史房间",
    desc: "查看所有会话，回到对话现场继续聊天。",
    cta: "查看 →",
    accent: "from-violet-400/80 to-violet-600/80",
  },
];

export function HomeDashboard() {
  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* ─ Compact hero ─ */}
      <section className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-2xl px-5 py-6 sm:rounded-[1.5rem] sm:px-10 sm:py-10">
        <div className="relative z-10">
          <span className="inline-flex rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase backdrop-blur-md">
            AI 协作工作台
          </span>
          <h1 className="mt-4 text-2xl font-display font-bold tracking-tight leading-tight sm:text-4xl">
            多模型顺序协作
            <span className="ml-2 text-white/40 font-light sm:ml-3">极简实验场</span>
          </h1>
          <p className="mt-3 max-w-xl text-[13px] font-medium leading-relaxed text-white/65 sm:text-[15px]">
            配置模型入口，编排协作流水线，发送一条消息即可见证多个 AI 依次作答。
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
            <Link
              href="/rooms/new"
              className="rounded-full bg-[linear-gradient(135deg,#f48498,#993c50)] px-5 py-2.5 text-[13px] font-bold text-white transition-all duration-300 hover:shadow-[0_12px_28px_rgba(153,60,80,0.32)] hover:-translate-y-0.5 active:scale-95 sm:px-6 sm:py-3"
            >
              立即创建房间
            </Link>
            <Link
              href="/rooms"
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-[13px] font-bold text-white transition-all duration-300 hover:bg-white/12 active:scale-95 backdrop-blur-md sm:px-6 sm:py-3"
            >
              查看历史记录
            </Link>
          </div>
        </div>
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[linear-gradient(135deg,#c98af0,#f48498)] opacity-20 blur-[60px] sm:h-64 sm:w-64 sm:blur-[80px]" />
        <div className="absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-[linear-gradient(135deg,#85a1ed,#5a7cd9)] opacity-15 blur-[40px] sm:h-48 sm:w-48 sm:blur-[60px]" />
      </section>

      {/* ─ Quick links ─ */}
      <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group ly-glass flex items-start gap-4 rounded-xl px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--accent)]/8 active:scale-[0.98] sm:rounded-2xl sm:px-5 sm:py-5"
          >
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.accent} text-[16px] shadow-md`}>
              {link.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-display font-bold tracking-tight">{link.title}</h3>
                <span className="text-[11px] font-bold text-[var(--accent)] opacity-0 transition-all duration-200 group-hover:opacity-100">
                  {link.cta}
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-[var(--muted)] sm:text-[13px]">{link.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* ─ Feature highlights ─ */}
      <section className="ly-glass rounded-xl px-4 py-4 sm:rounded-2xl sm:px-6 sm:py-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "实时顺序回复", body: "消息发出后，AI 按顺序逐条回答，实时指示当前轮到谁。" },
            { title: "容错不丢数据", body: "模型失败时已成功回复留存，页面明确告知部分完成状态。" },
            { title: "灵活编排", body: "拖拽排列模型顺序，支持单聊和群聊，随时调整协作流。" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-2.5">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
              <div>
                <p className="text-[12px] font-bold tracking-wide text-[var(--foreground)] uppercase">{item.title}</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-[var(--muted)]">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
