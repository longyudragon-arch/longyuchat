import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";
import {
  getProviderBadgeClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
} from "@/lib/client/chat-lab-client";

const workflowHighlights = [
  "先配模型，再建房间，再看 AI 依次作答。",
  "聊天页会显示轮次时间线、顺序进度和部分成功提示。",
  "支持私有部署、手机访问和微信打开，适合个人长期使用。",
];

const actionCards = [
  {
    href: "/models",
    eyebrow: "STEP 01",
    title: "配置模型",
    body: "录入 Provider、模型 ID、默认回复字数和连接状态，后续所有房间直接复用。",
    cta: "去模型管理",
  },
  {
    href: "/rooms/new",
    eyebrow: "STEP 02",
    title: "创建房间",
    body: "选择参与模型，拖拽排好回复顺序，立即生成新的协作房间。",
    cta: "去新建房间",
  },
  {
    href: "/rooms",
    eyebrow: "STEP 03",
    title: "继续聊天",
    body: "回到历史房间，查看最近消息、参与模型和当前协作状态。",
    cta: "去房间列表",
  },
];

const supportCards = [
  {
    eyebrow: "WORKFLOW",
    title: "顺序协作是核心，不是装饰",
    body: "这个产品最重要的体验不是“能聊天”，而是“多个模型按你指定的顺序轮流回答”，所以首页更应该服务于进入工作流，而不是解释概念。",
  },
  {
    eyebrow: "DEPLOYMENT",
    title: "已经适合个人长期部署",
    body: "当前版本具备站内登录、移动端访问、自动备份、日志轮转和一键更新脚本，适合放在自己的服务器上长期使用。",
  },
];

export function HomeDashboard() {
  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-6 py-7 sm:px-8 sm:py-8">
          <div className="relative">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
              LONGYU CHAT WORKSPACE
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              进入你的多模型协作工作台
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74 sm:text-base sm:leading-8">
              用最短路径进入真正有价值的操作：配置模型、创建房间、继续聊天，然后看多个 AI 按顺序依次回复。
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
          </div>
        </div>

        <aside className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">START HERE</p>
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="ly-glass rounded-[2.6rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">PROVIDER IDENTITY</p>
          <h2 className="mt-3 text-3xl font-semibold">统一的模型身份体系</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            不同 Provider 在模型管理、房间配置和聊天页里使用统一的颜色、缩写和标签，方便你在一眼之间识别是谁在说话。
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {providerOptions.map((provider) => (
              <span
                key={provider}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${getProviderBadgeClassName(provider)}`}
              >
                {getProviderShortName(provider)} / {getProviderOptionLabel(provider)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <LocalTestLauncher />

          <section className="grid gap-5 lg:grid-cols-2">
            {supportCards.map((card) => (
              <article key={card.title} className="ly-glass rounded-[2.2rem] p-5 sm:p-6">
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">{card.eyebrow}</p>
                <h2 className="mt-3 text-2xl font-semibold">{card.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.body}</p>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
