import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";

const workflowHighlights = [
  "先配模型，再建房间，再看 AI 依次作答。",
  "聊天页会显示轮次时间线、顺序进度和部分成功提示。",
  "支持私有部署、手机访问和微信打开，适合个人长期使用。",
];

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
      <section className="grid gap-4 lg:hidden">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.4rem] px-5 py-6">
          <div className="relative">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-white/78">
              移动工作台
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">把多个 AI 放进同一间房里协作回答</h1>
            <p className="mt-3 text-sm leading-7 text-white/74">
              手机上也不该只是缩小版网页。这里保留了最重要的能力：快速进房间、清楚看顺序、直接发消息。
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/rooms/new"
                className="rounded-[1.5rem] bg-white px-4 py-4 text-center text-sm font-medium text-[var(--foreground)] transition hover:bg-[#fff4ea]"
              >
                新建房间
              </Link>
              <Link
                href="/rooms"
                className="rounded-[1.5rem] border border-white/14 bg-white/8 px-4 py-4 text-center text-sm font-medium text-white transition hover:bg-white/12"
              >
                继续聊天
              </Link>
            </div>

            <div className="mt-6 grid gap-3">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/7 px-4 py-4"
                >
                  <p className="text-sm text-white/70">{fact.label}</p>
                  <p className="text-base font-semibold text-white">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ly-glass rounded-[2.2rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">立即开始</p>
              <h2 className="mt-2 text-2xl font-semibold">先做真正有用的三步</h2>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white/78 px-3 py-1 text-xs text-[var(--muted)]">手机优先</span>
          </div>

          <div className="mt-5 grid gap-3">
            {actionCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-[1.6rem] border border-[var(--border)] bg-white/84 px-4 py-4 transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent-strong)]">{card.eyebrow}</p>
                  <span className="text-sm font-medium text-[var(--accent)]">{card.cta}</span>
                </div>
                <h3 className="mt-2 text-xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.body}</p>
              </Link>
            ))}
          </div>
        </div>

        <LocalTestLauncher />
      </section>

      <section className="hidden gap-6 lg:grid xl:grid-cols-[0.95fr_1.05fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-6 py-7 sm:px-8 sm:py-8">
          <div className="relative">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
              LONGYU CHAT 工作台
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              进入你的多模型协作工作台
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74 sm:text-base sm:leading-8">
              首页的任务不是解释概念，而是带你直接进入工作流：配置模型、创建房间、继续聊天，然后看多个 AI
              按顺序依次回复。
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/rooms/new"
                className="rounded-full bg-white px-5 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[#fff4ea]"
              >
                立即创建房间
              </Link>
              <Link
                href="/rooms"
                className="rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                查看已有房间
              </Link>
            </div>

            <div className="mt-8 grid gap-3">
              {workflowHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-4 text-sm leading-6 text-white/82"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4 text-white/86"
                >
                  <p className="text-xs font-semibold tracking-[0.16em] text-white/50">{fact.label}</p>
                  <p className="mt-2 text-lg font-semibold">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">立即开始</p>
              <h2 className="mt-3 text-3xl font-semibold">直接开始，而不是先看长说明</h2>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white/78 px-3 py-1 text-xs text-[var(--muted)]">
              三步上手
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            {actionCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-[2rem] border border-[var(--border)] bg-white/84 px-5 py-5 transition hover:-translate-y-1 hover:border-[var(--accent)]"
              >
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">{card.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-semibold">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.body}</p>
                <span className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">{card.cta}</span>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-5 lg:grid-cols-2">
          {experienceCards.map((card) => (
            <article key={card.title} className="ly-glass rounded-[2.2rem] p-5 sm:p-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">{card.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.body}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="hidden lg:block">
            <LocalTestLauncher />
          </div>

          <section className="ly-glass rounded-[2.2rem] p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">NEXT ACTION</p>
            <h2 className="mt-3 text-2xl font-semibold">如果你是第一次用，最推荐这样开始</h2>
            <ol className="mt-5 grid gap-3 text-sm leading-7 text-[var(--muted)]">
              <li className="rounded-[1.4rem] border border-[var(--border)] bg-white/84 px-4 py-4">
                1. 先到模型管理页配置至少 2 个可用模型。
              </li>
              <li className="rounded-[1.4rem] border border-[var(--border)] bg-white/84 px-4 py-4">
                2. 去新建房间页拖拽出你希望的回复顺序。
              </li>
              <li className="rounded-[1.4rem] border border-[var(--border)] bg-white/84 px-4 py-4">
                3. 进入聊天页，看 AI 按顺序逐条出现，而不是一次性全部返回。
              </li>
            </ol>
          </section>
        </div>
      </section>
    </main>
  );
}
