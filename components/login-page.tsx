"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { describeClientError, fetchJson } from "@/lib/client/chat-lab-client";

const featureCards = [
  {
    title: "手机与微信可用",
    body: "访问站点时会先进入应用自己的登录页，不再依赖浏览器原生的 Authentication required 弹窗。",
  },
  {
    title: "为正式账号体系铺路",
    body: "当前是单用户登录入口，后续可以平滑升级到用户表、密码哈希、邀请制或第三方 OAuth。",
  },
  {
    title: "更适合 PWA",
    body: "站内登录和会话 Cookie 更容易接入 Web App 化能力，让手机打开时更像原生应用。",
  },
];

export function LoginPage({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submitLogin() {
    setBusy(true);
    setErrorMessage("");

    try {
      const result = await fetchJson<{ ok: true; nextPath: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          next: nextPath,
        }),
      });

      router.replace(result.nextPath || "/");
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(describeClientError(error).description);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl items-center px-4 py-8 sm:px-5">
      <div className="absolute inset-x-0 top-10 -z-10 mx-auto h-72 max-w-5xl rounded-full bg-[radial-gradient(circle,rgba(191,95,54,0.20),rgba(191,95,54,0.02)_64%,transparent_75%)] blur-3xl" />

      <section className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.4rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,247,236,0.96),rgba(255,255,255,0.90))] px-6 py-8 shadow-[0_30px_90px_rgba(17,17,17,0.10)] sm:px-8 sm:py-10">
          <span className="inline-flex rounded-full border border-[rgba(166,73,36,0.16)] bg-[rgba(255,246,232,0.86)] px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[var(--accent-strong)]">
            LONGYU CHAT ACCESS
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            站内登录已经替代浏览器级 Basic Auth
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
            这一步让手机浏览器、微信内打开和后续 PWA 安装都统一进入应用自己的登录流程，访问体验更完整，也更容易继续产品化。
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {featureCards.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.6rem] border border-[var(--border)] bg-white/82 px-4 py-4 shadow-[0_16px_32px_rgba(17,17,17,0.06)]"
              >
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[2.4rem] border border-[var(--border)] bg-[rgba(255,255,255,0.92)] px-6 py-8 shadow-[0_30px_90px_rgba(17,17,17,0.10)] sm:px-8 sm:py-10">
          <div className="rounded-[1.8rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,247,236,0.95),rgba(255,255,255,0.96))] px-5 py-5">
            <p className="text-sm font-semibold tracking-[0.16em] text-[var(--accent-strong)]">SECURE SIGN IN</p>
            <h2 className="mt-3 text-2xl font-semibold">登录 Longyu Chat</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              使用你在服务器环境变量中配置的单用户账号即可进入系统。
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                placeholder="请输入登录用户名"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-[var(--border)] bg-white/92 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                placeholder="请输入登录密码"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && username.trim() && password.trim() && !busy) {
                    event.preventDefault();
                    startTransition(() => {
                      void submitLogin();
                    });
                  }
                }}
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => startTransition(() => void submitLogin())}
              disabled={!username.trim() || !password.trim() || busy}
              className="mt-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {busy ? "正在登录..." : "进入工作台"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
