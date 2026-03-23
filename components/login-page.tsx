"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { describeClientError, fetchJson } from "@/lib/client/chat-lab-client";

const featureCards = [
  {
    title: "适合手机和微信访问",
    body: "现在进入站点会先落到应用自己的登录页，不再依赖浏览器原生的认证弹窗，移动端体验更完整。",
  },
  {
    title: "为正式账号体系预留空间",
    body: "当前是单用户登录入口，后续如果要增加用户表、邀请码或 OAuth，也能平滑延续这套结构。",
  },
  {
    title: "更适合 Web App 化",
    body: "站内登录和会话 Cookie 更容易接入 PWA、桌面添加到主屏幕和后续更稳定的移动体验。",
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
    <main className="relative mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-7xl items-center px-4 py-8 sm:px-5">
      <div className="absolute inset-x-0 top-8 -z-10 mx-auto h-72 max-w-5xl rounded-full bg-[radial-gradient(circle,rgba(191,95,54,0.24),rgba(191,95,54,0.02)_62%,transparent_72%)] blur-3xl" />

      <section className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[2.6rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,245,234,0.96),rgba(255,255,255,0.92))] px-6 py-8 shadow-[0_30px_90px_rgba(17,17,17,0.10)] sm:px-8 sm:py-10">
          <span className="inline-flex rounded-full border border-[rgba(191,95,54,0.14)] bg-[rgba(255,246,232,0.88)] px-3 py-1 text-xs font-semibold tracking-[0.22em] text-[var(--accent-strong)]">
            LONGYU CHAT ACCESS
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            用站内登录替代浏览器级认证，让访问体验更完整
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base sm:leading-8">
            这一页会成为你所有设备统一的进入入口。无论是桌面浏览器、手机浏览器，还是微信内打开，都会走同一套登录流程。
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {featureCards.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.7rem] border border-[var(--border)] bg-white/82 px-4 py-4 shadow-[0_16px_32px_rgba(17,17,17,0.06)]"
              >
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[2.6rem] border border-[var(--border)] bg-[rgba(255,255,255,0.94)] px-6 py-8 shadow-[0_30px_90px_rgba(17,17,17,0.10)] sm:px-8 sm:py-10">
          <div className="rounded-[1.9rem] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,247,236,0.95),rgba(255,255,255,0.98))] px-5 py-5">
            <p className="text-sm font-semibold tracking-[0.16em] text-[var(--accent-strong)]">SECURE SIGN IN</p>
            <h2 className="mt-3 text-2xl font-semibold">登录 Longyu Chat</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              使用你在服务器环境变量里配置的应用账号进入系统。
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
