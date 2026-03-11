import Link from "next/link";

import { LocalTestLauncher } from "@/components/local-test-launcher";
import {
  getProviderBadgeClassName,
  getProviderOptionLabel,
  getProviderShortName,
  providerOptions,
} from "@/lib/client/chat-lab-client";

const productCards = [
  {
    href: "/models",
    eyebrow: "Model Control",
    title: "模型管理",
    body: "统一维护 API 地址、模型 ID、默认回复字数、连接测试和 Provider 差异，方便从一处扩展到更多平台。",
  },
  {
    href: "/rooms",
    eyebrow: "Conversation Flow",
    title: "会话空间",
    body: "把单聊、群聊和历史记录放进独立工作区，后续继续补搜索、归档、导出和更多协作模式会更稳。",
  },
  {
    href: "/rooms/new",
    eyebrow: "Launch New Room",
    title: "新建房间",
    body: "支持拖拽排序模型顺序，创建时就能看出不同 Provider 的颜色与身份标识，适合快速验证多模型编排。",
  },
];

const capabilityList = [
  "站内登录，替代浏览器级 Basic Auth",
  "OpenAI compatible、多 Provider 管理与连通测试",
  "多模型顺序回复、历史消息持久化、单机可部署",
  "面向手机浏览器和微信访问的 Web App 体验",
];

export function HomeDashboard() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-5 sm:py-8">
      <section className="relative overflow-hidden rounded-[2.4rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,236,0.96),rgba(255,255,255,0.88))] px-5 py-6 shadow-[0_30px_90px_rgba(17,17,17,0.09)] sm:px-8 sm:py-10">
        <div className="absolute right-[-3rem] top-[-4rem] h-56 w-56 rounded-full bg-[rgba(191,95,54,0.10)] blur-3xl" />
        <div className="absolute bottom-[-5rem] left-[-4rem] h-64 w-64 rounded-full bg-[rgba(29,119,181,0.08)] blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="inline-flex rounded-full border border-[rgba(166,73,36,0.16)] bg-[rgba(255,246,232,0.86)] px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[var(--accent-strong)]">
              LONGYU CHAT LAB
            </span>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              为多模型对话、对比和私有部署准备的一体化工作台
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
              现在的首页不再只是开发占位页，而是面向真实使用场景的品牌入口。它把模型接入、房间创建、聊天编排和手机端访问连成一条更顺手的路径。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/rooms/new"
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
              >
                开始一个新房间
              </Link>
              <Link
                href="/models"
                className="rounded-full border border-[var(--border)] bg-white/82 px-5 py-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                配置模型与 Key
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilityList.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-white/72 px-4 py-4 text-sm leading-6 text-[var(--foreground)] shadow-[0_16px_32px_rgba(17,17,17,0.05)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-[var(--border)] bg-[rgba(255,255,255,0.84)] p-5 shadow-[0_18px_48px_rgba(17,17,17,0.06)] sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">PROVIDER SYSTEM</p>
            <h2 className="mt-3 text-2xl font-semibold">统一的模型身份系统</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              不同 Provider 在模型页、房间创建页和聊天页都会使用同一套颜色与缩写，帮助你快速识别谁在说话。
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
                当前仓库已经补齐单机部署、健康检查、密钥加密、限流、备份和日志轮转，适合个人服务器和小流量长期使用。
              </p>
            </div>
          </aside>
        </div>
      </section>

      <LocalTestLauncher />

      <section className="grid gap-5 lg:grid-cols-3">
        {productCards.map((card) => (
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
            <span className="mt-6 inline-flex text-sm font-medium text-[var(--accent)]">
              进入页面
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
