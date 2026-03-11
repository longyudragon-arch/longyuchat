import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";
import {
  getProviderBadgeClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
} from "@/lib/client/chat-lab-client";

const cards = [
  {
    href: "/models",
    title: "模型管理",
    body: "单独维护模型配置、连接测试、默认回复字数和 provider 差异，不再和聊天页混在一起。",
  },
  {
    href: "/rooms",
    title: "房间列表",
    body: "会话列表独立成页，后续继续加筛选、归档和搜索时，也不会挤占聊天主视图。",
  },
  {
    href: "/rooms/new",
    title: "新建房间",
    body: "创建流程单独成页，模型顺序支持拖拽排序，并且在建房时就能看出不同 provider 的颜色区分。",
  },
];

export function HomeDashboard() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-5 sm:py-8">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] px-5 py-6 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:px-6 sm:py-8">
        <span className="inline-flex rounded-full border border-[var(--border)] bg-white/80 px-3 py-1 text-xs font-medium tracking-[0.2em] text-[var(--accent)]">
          PRODUCT FLOW
        </span>
        <div className="mt-5 max-w-4xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">AI 多模型聊天室已经拆成更接近正式产品的页面结构</h1>
          <p className="text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
            当前项目已经从一个大工作台拆成模型管理、房间列表、创建房间和房间聊天四个独立页面。后续继续扩展搜索、归档、更多
            provider 或客户端形态时，结构会稳定很多。
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] px-5 py-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Provider 识别色</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              不管在模型列表、房间排序还是聊天消息里，都会沿用这一套颜色和缩写标识。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
      </section>

      <LocalTestLauncher />

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_20px_60px_rgba(17,17,17,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] sm:p-6"
          >
            <h2 className="text-2xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
