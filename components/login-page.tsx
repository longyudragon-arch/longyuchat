"use client";

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
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="ly-glass rounded-2xl p-6 shadow-xl sm:rounded-[1.5rem] sm:p-8">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-sm font-display font-bold text-white shadow-lg shadow-[var(--accent)]/25">
              LY
            </span>
            <h1 className="mt-4 text-2xl font-display font-bold tracking-tight">登录 LongyuChat</h1>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[var(--muted)]">
              使用服务器环境变量中配置的应用账号进入系统。
            </p>
          </div>

          {/* Form */}
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">用户名</label>
              <input
                data-testid="login-username"
                aria-label="登录用户名"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFieldErrors((current) => ({ ...current, username: undefined }));
                }}
                autoComplete="username"
                className={`w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 text-[14px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-xl ${getInputErrorClass(fieldErrors.username)}`}
                placeholder="请输入登录用户名"
              />
              <FieldErrorHint message={fieldErrors.username} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase ml-1">密码</label>
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
                className={`w-full rounded-xl border border-white/40 bg-white/30 px-4 py-3 text-[14px] font-medium outline-none transition focus:bg-white focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 backdrop-blur-xl ${getInputErrorClass(fieldErrors.password)}`}
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
              className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 text-[15px] font-bold text-white shadow-md shadow-[var(--accent)]/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            >
              {busy ? "正在登录..." : "进入工作台"}
            </button>
          </div>

          {/* Footer hints */}
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              { title: "手机友好", desc: "站内登录，不依赖浏览器弹窗" },
              { title: "可扩展", desc: "预留账号体系和 OAuth 空间" },
              { title: "PWA 就绪", desc: "支持主屏快捷方式" },
            ].map((item) => (
              <div key={item.title} className="rounded-lg bg-[var(--foreground)]/3 px-3 py-2 text-center">
                <p className="text-[11px] font-bold tracking-wide">{item.title}</p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
