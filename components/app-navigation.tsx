"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { fetchJson } from "@/lib/client/chat-lab-client";
import type { AuthSessionView } from "@/types/app";

const navItems = [
  { href: "/", label: "首页", match: (pathname: string) => pathname === "/" },
  { href: "/models", label: "模型管理", match: (pathname: string) => pathname.startsWith("/models") },
  {
    href: "/rooms",
    label: "房间列表",
    match: (pathname: string) => pathname === "/rooms" || /^\/rooms\/[^/]+(?:\/edit)?$/.test(pathname),
  },
  { href: "/rooms/new", label: "新建房间", match: (pathname: string) => pathname === "/rooms/new" },
];

function BrandBlock() {
  return (
    <Link href="/" className="inline-flex min-w-0 items-center gap-3">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,#ffd0a8,#c35a2f)] text-sm font-semibold text-white shadow-[0_18px_40px_rgba(195,90,47,0.24)]">
        LY
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
          Longyu Chat
        </span>
        <span className="block truncate text-xs tracking-[0.18em] text-[var(--muted)] sm:text-[11px]">
          MULTI-MODEL WORKSPACE
        </span>
      </span>
    </Link>
  );
}

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSessionView | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshSession = useEffectEvent(async () => {
    try {
      const data = await fetchJson<AuthSessionView>("/api/auth/session");
      setSession(data);
    } catch {
      setSession(null);
    }
  });

  useEffect(() => {
    startTransition(() => {
      void refreshSession();
    });
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);

    try {
      await fetchJson<{ ok: true }>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const isLoginPage = pathname === "/login";

  return (
    <header className="sticky top-0 z-40 px-4 pb-3 pt-4 sm:px-5">
      <div className="ly-shell">
        <div className="ly-glass overflow-hidden rounded-[2rem] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start justify-between gap-4">
              <BrandBlock />
              {session?.mode === "app" ? (
                <span className="shrink-0 rounded-full bg-[var(--navy-soft)] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[var(--navy)]">
                  站内登录
                </span>
              ) : null}
            </div>

            {!isLoginPage ? (
              <div className="flex flex-col gap-3 xl:items-end">
                <nav className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {navItems.map((item) => {
                    const active = item.match(pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                          active
                            ? "border border-[rgba(31,47,68,0.10)] bg-[var(--navy-soft)] text-[var(--navy)] shadow-[0_10px_20px_rgba(31,47,68,0.10)]"
                            : "border border-[var(--border)] bg-white/72 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {session?.mode === "app" && session.authenticated ? (
                    <>
                      <span className="rounded-full border border-[var(--border)] bg-white/78 px-3 py-2 text-[var(--muted)]">
                        当前账号：{session.username ?? "owner"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void logout())}
                        disabled={loggingOut}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loggingOut ? "退出中..." : "退出登录"}
                      </button>
                    </>
                  ) : null}

                  {session?.mode === "basic" ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                      浏览器级 Basic Auth 已启用
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-full bg-[var(--navy-soft)] px-3 py-2 text-xs font-semibold tracking-[0.18em] text-[var(--navy)]">
                安全访问入口
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
