import Link from "next/link";

export function HomeDashboard() {
  return (
    <main className="ly-page-wrap min-h-[calc(100vh-4rem)]">
      <div className="ly-shell flex min-h-[calc(100vh-6rem)] flex-col gap-8 pb-8">
        <section className="ly-glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10 xl:p-12">
          <div className="absolute inset-y-0 right-0 w-[42%] opacity-40 pointer-events-none">
            <div className="h-full w-full bg-gradient-to-bl from-[#FF8DA1] via-[#f4b6d8] to-transparent blur-[120px] mix-blend-overlay" />
          </div>

          <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.92fr)] xl:items-stretch">
            <div className="flex flex-col justify-between gap-8">
              <div className="max-w-[56rem]">
                <div className="mb-6 flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full bg-[#FF8DA1]/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#DC75A5]">
                    Workbench v2.4
                  </span>
                  <span className="text-xs text-stone-400">•</span>
                  <span className="text-xs font-medium text-stone-500">多模型协作实验场</span>
                </div>

                <h1 className="mb-4 text-[2.4rem] font-display font-bold tracking-[-0.05em] text-[#6b4d62] sm:text-[2.9rem] lg:text-[3.4rem]">
                  AI 协作工作台
                </h1>
                <p className="max-w-[48rem] text-lg leading-relaxed text-stone-600 sm:text-[1.22rem]">
                  配置大语言模型作为协作节点，让一条消息触发整条流水线的依次应答。
                  这里不是普通聊天页，而是一套可以稳定排演、观察和复用多模型协作过程的工作台。
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/rooms/new"
                  className="ly-primary-action group flex min-h-12 items-center gap-3 px-8 py-4 font-bold"
                >
                  立刻创建房间
                  <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <Link
                  href="/rooms"
                  className="ly-secondary-action flex min-h-12 items-center px-8 py-4 font-bold text-[#2f2e33] active:scale-95"
                >
                  查看历史会话
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="ly-surface-card p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#DC75A5]">协作流程</p>
                  <span className="rounded-full bg-[#FF8DA1]/15 px-2.5 py-1 text-[10px] font-bold text-[#DC75A5]">顺序执行</span>
                </div>
                <div className="space-y-3">
                  {[
                    "先配置模型节点和接入信息",
                    "按顺序组合模型并创建房间",
                    "发送一条消息后观察整条流水线回复",
                  ].map((item, index) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/45 px-4 py-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DC75A5] text-[11px] font-bold text-white">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium leading-6 text-stone-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ly-surface-card p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#DC75A5]">工作台入口</p>
                  <span className="text-[11px] font-semibold text-stone-400">立即开始</span>
                </div>
                <div className="space-y-2">
                  <Link href="/models" className="group flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/70">
                    <div>
                      <p className="font-bold text-[#2f2e33]">模型管理</p>
                      <p className="text-xs text-stone-500">配置接入信息与默认回复参数</p>
                    </div>
                    <span className="text-[#DC75A5] transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                  <Link href="/rooms" className="group flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/70">
                    <div>
                      <p className="font-bold text-[#2f2e33]">历史房间</p>
                      <p className="text-xs text-stone-500">回到已有会话，继续之前的协作</p>
                    </div>
                    <span className="text-[#DC75A5] transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                  <Link href="/rooms/new" className="group flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/70">
                    <div>
                      <p className="font-bold text-[#2f2e33]">新建房间</p>
                      <p className="text-xs text-stone-500">搭建单聊或多模型顺序协作流程</p>
                    </div>
                    <span className="text-[#DC75A5] transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.92fr)]">
          <div className="space-y-6">
            <h3 className="flex items-center gap-3 px-2 text-2xl font-bold text-[#DC75A5]">
              <span className="h-6 w-1.5 rounded-full bg-[#DC75A5]" />
              关于多模型顺序对话
            </h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="ly-surface-card ly-surface-card-hover flex h-full flex-col p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl bg-[#FF8DA1]/10 p-3">
                    <svg className="h-6 w-6 text-[#DC75A5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Feature</span>
                </div>
                <h4 className="mb-2 text-lg font-bold text-[#2f2e33]">流水线协作</h4>
                <p className="text-sm leading-relaxed text-stone-500">
                  选择多个模型组合，让上一个模型的输出作为下一个模型的上下文，实现复杂任务的自动化接力完成。
                </p>
              </div>

              <div className="ly-surface-card ly-surface-card-hover flex h-full flex-col p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <svg className="h-6 w-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Experiment</span>
                </div>
                <h4 className="mb-2 text-lg font-bold text-[#2f2e33]">多模型实验对比</h4>
                <p className="text-sm leading-relaxed text-stone-500">
                  您可以在一个房间内同时配置不同厂商的模型，直观观察和对比它们在处理同一任务时的差异。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="flex items-center gap-3 px-2 text-2xl font-bold text-[#DC75A5]">
              <span className="h-6 w-1.5 rounded-full bg-[#DC75A5]" />
              使用建议
            </h3>

            <div className="ly-surface-card h-full p-6">
              <div className="grid gap-4">
                {[
                  { title: "先接入真实模型", description: "先在模型管理中填好 API Key、Base URL 和模型 ID，再开始组装流程。" },
                  { title: "从小房间开始试", description: "先用 2 到 3 个模型做顺序协作，确认回复逻辑和节奏都符合预期。" },
                  { title: "历史房间可续聊", description: "房间会保留历史记录，你可以回到之前的协作现场继续补充问题。" },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.5rem] bg-white/45 px-4 py-4">
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
