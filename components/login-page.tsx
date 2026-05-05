"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import {
  type ClientErrorFeedback,
  describeClientError,
  fetchJson,
} from "@/lib/client/longyuchat-client";
import { resolveLoginFieldErrors, type LoginFieldKey } from "@/components/login-page-error-resolver";
import {
  FeedbackPanel,
  FieldErrorHint,
  getInputErrorClass,
} from "@/components/models-page/shared-ui";

export function LoginPage({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ClientErrorFeedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginFieldKey, string>>>({});
  const destinationLabel = nextPath.startsWith("/rooms")
    ? "AI 聊天室"
    : nextPath.startsWith("/models")
      ? "模型管理"
      : nextPath.startsWith("/admin")
        ? "后台管理"
        : "工作台";

  async function submitLogin() {
    setBusy(true);
    setFeedback(null);
    setFieldErrors({});

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
      const nextFeedback = describeClientError(error);
      setFeedback(nextFeedback);
      setFieldErrors(resolveLoginFieldErrors(error, nextFeedback));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ly-page-bg ly-page-chat min-h-dvh px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col">
        <header className="ly-glass flex items-center justify-between gap-3 rounded-[1.35rem] px-3 py-2 sm:px-4">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/70 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/portal/feather-logo-transparent.png"
                alt=""
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
                priority
                unoptimized
              />
            </span>
            <span className="text-[15px] font-display font-bold tracking-tight text-[var(--foreground)]">
              LongyuChat
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/daily"
              className="hidden rounded-xl px-3 py-2 text-[12px] font-bold text-[var(--muted)] transition hover:bg-white/50 hover:text-[var(--foreground)] sm:inline-flex"
            >
              AI 日报
            </Link>
            <Link
              href="/"
              className="rounded-xl bg-white/70 px-3.5 py-2 text-[12px] font-bold text-[var(--foreground)] shadow-sm ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:bg-white"
            >
              返回首页
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-7 py-8 lg:grid-cols-[minmax(0,1fr)_28rem] lg:py-12">
          <div className="max-w-2xl">
            <p className="text-[12px] font-black tracking-[0.18em] text-[var(--accent)] uppercase">
              Private Workspace
            </p>
            <h1 className="mt-4 max-w-[12ch] text-5xl font-display font-black leading-[0.96] tracking-tight text-[var(--foreground)] sm:text-6xl">
              进入 {destinationLabel}
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-[var(--ink-3)]">
              公开页面可以直接浏览；会消耗模型 API、保存配置或进入后台的区域需要登录。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/"
                className="ly-hero-secondary-action inline-flex items-center justify-center px-5 text-sm font-black"
              >
                回到公开首页
              </Link>
              <Link
                href="/daily"
                className="ly-secondary-action inline-flex min-h-12 items-center justify-center px-5 text-sm font-black"
              >
                先看 AI 日报
              </Link>
            </div>
          </div>

          <div className="w-full">
            <div className="ly-surface-card rounded-[1.6rem] p-6 shadow-xl sm:p-8">
              <div className="text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FBBF24] via-[#F59E0B] to-[#D97706] text-sm font-display font-bold text-white shadow-lg shadow-amber-500/25">
                  LY
                </span>
                <h2 className="mt-4 text-2xl font-display font-bold tracking-tight">登录 LongyuChat</h2>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[var(--muted)]">
                  使用服务器环境变量中配置的应用账号继续访问。
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">用户名</label>
                  <input
                    data-testid="login-username"
                    aria-label="登录用户名"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setFieldErrors((current) => ({ ...current, username: undefined }));
                    }}
                    autoComplete="username"
                    className={`w-full rounded-xl border border-white/50 bg-white/48 px-4 py-3 text-[14px] font-medium outline-none backdrop-blur-xl transition focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/10 ${getInputErrorClass(fieldErrors.username)}`}
                    placeholder="请输入登录用户名"
                  />
                  <FieldErrorHint message={fieldErrors.username} />
                </div>

                <div className="space-y-1.5">
                  <label className="ml-1 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">密码</label>
                  <input
                    data-testid="login-password"
                    aria-label="登录密码"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFieldErrors((current) => ({ ...current, password: undefined }));
                    }}
                    type="password"
                    autoComplete="current-password"
                    className={`w-full rounded-xl border border-white/50 bg-white/48 px-4 py-3 text-[14px] font-medium outline-none backdrop-blur-xl transition focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/10 ${getInputErrorClass(fieldErrors.password)}`}
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
                  <FieldErrorHint message={fieldErrors.password} />
                </div>

                {feedback ? <FeedbackPanel feedback={feedback} /> : null}

                <button
                  type="button"
                  data-testid="login-submit"
                  onClick={() => startTransition(() => void submitLogin())}
                  disabled={!username.trim() || !password.trim() || busy}
                  className="ly-primary-action w-full px-5 py-3.5 text-[15px] font-bold disabled:cursor-not-allowed"
                >
                  {busy ? "正在登录..." : `进入${destinationLabel}`}
                </button>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  { title: "公开首页", desc: "不用登录也能访问" },
                  { title: "工作区保护", desc: "聊天和模型配置受控" },
                  { title: "站内登录", desc: "不依赖浏览器弹窗" },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg bg-[var(--foreground)]/3 px-3 py-2 text-center">
                    <p className="text-[11px] font-bold tracking-wide">{item.title}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
