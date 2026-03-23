import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";
import {
  getProviderBadgeClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
} from "@/lib/client/chat-lab-client";

const capabilityList = [
  "模型配置、连接测试、单聊、群聊和历史续聊全部在同一套工作流中完成。",
  "多模型群聊支持固定顺序回复，重点突出“依次发言”和“协作进度”的展示。",
  "支持私有部署、手机访问和微信打开，适合个人长期使用与持续迭代。",
  "已经具备本地 mock、部署、备份、日志和健康检查等基础运维能力。",
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
    body: "查看历史会话、最近消息、成员模型和房间类型，快速回到任意聊天现场。",
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
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="relative overflow-hidden rounded-[2.6rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,238,0.96),rgba(255,255,255,0.88))] px-5 py-6 shadow-[0_30px_90px_rgba(17,17,17,0.10)] sm:px-8 sm:py-10">
        <div className="absolute right-[-4rem] top-[-4rem] h-72 w-72 rounded-full bg-[rgba(191,95,54,0.10)] blur-3xl" />
        <div className="absolute bottom-[-5rem] left-[-4rem] h-72 w-72 rounded-full bg-[rgba(39,111,176,0.08)] blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="inline-flex rounded-full border border-[rgba(191,95,54,0.14)] bg-[rgba(255,246,232,0.92)] px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[var(--accent-strong)]">
              LONGYU CHAT WORKSPACE
            </span>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              面向中文用户的多模型协作聊天工作台
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              这是一个围绕“模型配置、顺序协作、私有部署、移动访问”设计的产品化入口。你可以在这里接入多个 AI
              模型，让它们在一个房间里按顺序依次回答，再回到历史房间继续聊。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/rooms/new"
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
              >
                新建一个房间
              </Link>
              <Link
                href="/models"
                className="rounded-full border border-[var(--border)] bg-white/82 px-5 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                先去配置模型
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilityList.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-white/76 px-4 py-4 text-sm leading-6 text-[var(--foreground)] shadow-[0_16px_32px_rgba(17,17,17,0.05)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.86)] p-5 shadow-[0_18px_48px_rgba(17,17,17,0.06)] sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">PROVIDER IDENTITY</p>
            <h2 className="mt-3 text-2xl font-semibold">统一的模型身份体系</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              不同 Provider 在模型管理、房间配置和聊天页里使用统一的颜色、缩写和标签，方便你快速识别是谁在说话。
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

            <div className="mt-6 rounded-[1.6rem] border border-[var(--border)] bg-[rgb(255,252,247)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">适合当前阶段的部署方式</p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                当前版本已经具备登录入口、移动端基础体验、自动备份、日志轮转和一键更新脚本，适合个人服务器长期使用。
              </p>
            </div>
          </aside>
        </div>
      </section>

      <LocalTestLauncher />

      <section className="grid gap-5 lg:grid-cols-3">
        {pageCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] transition hover:-translate-y-1 hover:border-[var(--accent)] sm:p-6"
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
    </main>
  );
}
