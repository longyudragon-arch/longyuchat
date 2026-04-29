const profilePoints = [
  "关注 AI 应用落地、工具效率和内容整理。",
  "在重庆做长期主义的小产品，把观察、实验和复盘沉淀到 LongyuChat。",
  "希望这里既能给 AI 从业者提供信息，也能让合作方快速理解我在做什么。",
];

export function AboutPage() {
  return (
    <main className="ly-page-wrap ly-page-about">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          <div className="ly-page-header">
            <div className="ly-page-heading">
              <h1 className="ly-page-title">个人简介</h1>
              <p className="ly-page-subtitle">
                少一点口号，多一点正在做的事。
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <div className="ly-surface-card p-5 sm:p-6">
            <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
              Profile
            </p>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-[var(--foreground)]">
              把 AI 信息、模型协作和项目观察放在一个地方。
            </h2>
          </div>

          <div className="ly-surface-card p-5 sm:p-6">
            <div className="grid gap-3">
              {profilePoints.map((point, index) => (
                <div key={point} className="rounded-[1.15rem] bg-white/50 px-4 py-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-7 text-slate-600">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
