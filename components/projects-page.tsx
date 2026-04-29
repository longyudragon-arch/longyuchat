import Link from "next/link";

const projectTracks = [
  {
    title: "开源工具",
    description: "筛选能真正进入日常工作流的 AI 工具、MCP 服务和开发者组件。",
  },
  {
    title: "应用案例",
    description: "记录值得拆解的 AI 产品形态，关注交互、效率和落地路径。",
  },
  {
    title: "技术栈观察",
    description: "把 GitHub 项目、论文实现和工程实践放在同一张地图里比较。",
  },
];

export function ProjectsPage() {
  return (
    <main className="ly-page-wrap ly-page-projects">
      <div className="ly-shell page-rise flex flex-col gap-5">
        <section className="ly-glass rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-7">
          <div className="ly-page-header">
            <div className="ly-page-heading">
              <h1 className="ly-page-title">项目推荐</h1>
              <p className="ly-page-subtitle">
                这里会整理值得长期关注的 AI 项目、开源工具和产品案例。
              </p>
            </div>
            <div className="ly-page-actions">
              <Link href="/" className="ly-page-action ly-secondary-action px-4 py-2 text-[13px] font-bold">
                返回首页
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {projectTracks.map((track) => (
            <article key={track.title} className="ly-surface-card ly-surface-card-hover p-5 sm:p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
                Coming Soon
              </p>
              <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                {track.title}
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                {track.description}
              </p>
            </article>
          ))}
        </section>

        <section className="ly-surface-card p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent)]">
                Roadmap
              </p>
              <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-[var(--foreground)]">
                先做入口，再接真实推荐流
              </h2>
            </div>
            <p className="text-sm font-medium leading-7 text-slate-500">
              当前页面先承担一级导航结构和内容预告。后续可以接 GitHub 项目推荐、专题页和日报引用，把“看见趋势”和“找到项目”连起来。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
