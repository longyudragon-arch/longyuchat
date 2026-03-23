import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";
import {
  getProviderBadgeClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
} from "@/lib/client/chat-lab-client";

const capabilityList = [
  "模型配置、连接测试、单聊、群聊和历史续聊全部在同一套工作流里完成。",
  "多模型群聊强调“依次发言”和“协作进度”，不是普通聊天窗口的简单堆叠。",
  "支持私有部署、手机访问和微信打开，适合个人长期使用与持续迭代。",
  "已经具备本地 mock、备份、日志和健康检查等基础运维能力。",
];

const pageCards = [
  {
    href: "/models",
    eyebrow: "Model Center",
    title: "模型管理",
    body: "统一维护 Provider、Base URL、模型 ID、默认回复字数、连接测试和模型发现。",
  },
  {
    href: "/rooms",
    eyebrow: "Room Hub",
    title: "房间列表",
    body: "查看历史会话、最近消息、参与模型和房间类型，快速回到任意聊天现场。",
  },
  {
    href: "/rooms/new",
    eyebrow: "Launch Flow",
    title: "新建房间",
    body: "从选模型、拖拽排序到创建群聊，直接把顺序协作的意图配置清楚。",
  },
];

export function HomeDashboard() {
  return (
    <main className="ly-shell flex flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-6 py-7 sm:px-8 sm:py-9">
          <div className="relative">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
              LONGYU CHAT WORKSPACE
            </span>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
              让多个 AI 在同一间房里按顺序协作发言
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/74 sm:text-base sm:leading-8">
              这不是一个普通聊天页，而是一套把“模型配置、顺序协作、私有部署、移动访问”串成闭环的中文工作台。
              你可以配置多个模型，让它们轮流作答，再回到历史房间继续聊。
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/rooms/new"
                className="rounded-full bg-white px-5 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[#fff4ea]"
              >
                立即创建房间
              </Link>
              <Link
                href="/models"
                className="rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                先去配置模型
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilityList.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.6rem] border border-white/10 bg-white/7 px-4 py-4 text-sm leading-6 text-white/82"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="ly-glass rounded-[2.8rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">COLLABORATION MAP</p>
          <h2 className="mt-3 text-3xl font-semibold">顺序协作不只是“等回复”</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            你可以把不同 Provider 的模型放进同一个房间里，按照你指定的顺序轮流回复。
            聊天页会保留用户消息状态、顺序时间线和部分成功反馈，方便你看清谁先答、谁中途失败、谁还在等待。
          </p>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/86 p-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">STEP 01</p>
              <p className="mt-2 text-lg font-semibold">配置模型与身份</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                为每个模型设置 Provider、模型 ID、默认回复字数和连接状态，让后续房间直接复用。
              </p>
            </div>
            <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/86 p-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">STEP 02</p>
              <p className="mt-2 text-lg font-semibold">拖拽决定回复顺序</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                新建房间时用拖拽方式排好模型发言顺序，聊天页也能随时调整并保存。
              </p>
            </div>
            <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/86 p-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">STEP 03</p>
              <p className="mt-2 text-lg font-semibold">看 AI 依次作答</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                用户发出消息后，模型会逐个落库、逐个出现，并以时间线方式展示当前轮到谁。
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="ly-glass rounded-[2.6rem] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">PROVIDER IDENTITY</p>
          <h2 className="mt-3 text-3xl font-semibold">统一的模型身份体系</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            不同 Provider 在模型管理、房间配置和聊天页里使用统一的颜色、缩写和标签，
            方便你在一眼之间识别是谁在说话。
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

          <div className="mt-6 rounded-[1.8rem] border border-[var(--border)] bg-[var(--navy)] px-4 py-4 text-white shadow-[0_20px_40px_rgba(31,47,68,0.16)]">
            <p className="text-sm font-semibold">适合当前阶段的部署方式</p>
            <p className="mt-2 text-sm leading-7 text-white/72">
              当前版本已经具备站内登录、移动端基础体验、自动备份、日志轮转和一键更新脚本，
              适合个人服务器长期使用。
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <LocalTestLauncher />
          <section className="grid gap-5 lg:grid-cols-3">
            {pageCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="ly-glass group rounded-[2.2rem] p-5 transition hover:-translate-y-1 sm:p-6"
              >
                <span className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">
                  {card.eyebrow}
                </span>
                <h2 className="mt-3 text-2xl font-semibold">{card.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.body}</p>
                <span className="mt-6 inline-flex text-sm font-medium text-[var(--accent)]">进入页面</span>
              </Link>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
