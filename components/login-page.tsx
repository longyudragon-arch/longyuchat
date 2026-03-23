"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { describeClientError, fetchJson } from "@/lib/client/chat-lab-client";

const featureCards = [
  {
    title: "更适合手机与微信访问",
    body: "现在进入站点会先落到应用自己的登录页，不再依赖浏览器原生认证弹窗，移动端体验更完整。",
  },
  {
    title: "为正式账号体系预留空间",
    body: "当前是单用户登录入口，后续如果要增加用户表、邀请码或 OAuth，也能平滑延续这套结构。",
  },
  {
    title: "更适合 Web App 化",
    body: "站内登录和会话 Cookie 更容易接入 PWA、主屏幕快捷方式和更稳定的移动体验。",
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
    <main className="ly-shell relative flex min-h-[calc(100vh-110px)] w-full items-center px-4 py-8 sm:px-5">
      <section className="grid w-full gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="ly-dark-panel ly-grid-lines relative overflow-hidden rounded-[2.8rem] px-6 py-8 sm:px-8 sm:py-10">
          <div className="relative">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-white/78">
              SECURE ACCESS
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              用站内登录替代浏览器级认证，让访问体验真正可控
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base sm:leading-8">
              这一页会成为你所有设备统一的进入入口。无论是桌面浏览器、手机浏览器，还是微信内打开，都走同一套登录流程。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {featureCards.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.7rem] border border-white/10 bg-white/7 px-4 py-4 shadow-[0_14px_30px_rgba(0,0,0,0.08)]"
                >
                  <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/72">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="ly-glass rounded-[2.8rem] px-6 py-8 sm:px-8 sm:py-10">
          <div className="rounded-[2rem] border border-[var(--border)] bg-white/78 px-5 py-5">
            <p className="text-sm font-semibold tracking-[0.16em] text-[var(--accent-strong)]">APP LOGIN</p>
            <h2 className="mt-3 text-3xl font-semibold">登录 Longyu Chat</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              使用你在服务器环境变量中配置的应用账号进入系统。
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/94 px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(195,90,47,0.12)]"
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
                className="w-full rounded-[1.4rem] border border-[var(--border)] bg-white/94 px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(195,90,47,0.12)]"
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
              <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => startTransition(() => void submitLogin())}
              disabled={!username.trim() || !password.trim() || busy}
              className="mt-2 rounded-[1.4rem] bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {busy ? "正在登录..." : "进入工作台"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
