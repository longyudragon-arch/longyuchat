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
    match: (pathname: string) =>
      pathname === "/rooms" || /^\/rooms\/(?!new(?:\/|$))[^/]+(?:\/edit)?$/.test(pathname),
  },
  { href: "/rooms/new", label: "新建房间", match: (pathname: string) => pathname === "/rooms/new" },
];

function BrandBlock() {
  return (
    <Link href="/" className="inline-flex min-w-0 items-center gap-3 group">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,#f48498,#993c50)] text-[13px] font-display font-bold text-white shadow-[0_8px_24px_rgba(153,60,80,0.25)] transition-all duration-300 ease-out group-hover:scale-105 group-hover:shadow-[0_12px_32px_rgba(153,60,80,0.35)] sm:h-11 sm:w-11 sm:rounded-[1.125rem] sm:text-[14px]">
        LY
      </span>
      <span className="min-w-0 flex flex-col justify-center">
        <span className="block truncate text-[15px] font-display font-bold tracking-tight text-[var(--foreground)] sm:text-[18px]">
          Longyu Chat
        </span>
        <span className="mt-0.5 hidden truncate text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] uppercase sm:block">
          多模型工作台
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
    <header className="sticky top-0 z-40 px-3 pb-2 pt-3 sm:px-6 sm:pb-4 sm:pt-6">
      <div className="ly-shell">
        <div className="ly-glass overflow-hidden rounded-[1.6rem] px-4 py-3 sm:rounded-[2.5rem] sm:px-6 sm:py-4 transition-all duration-500 hover:shadow-[0_32px_80px_rgba(47,46,51,0.06)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-4">
              <BrandBlock />
              <div className="flex items-center gap-2">
                {session?.mode === "app" ? (
                  <span className="shrink-0 rounded-full bg-[var(--accent)]/5 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-[var(--accent)] uppercase border border-[var(--accent)]/10 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.15em]">
                    已登录
                  </span>
                ) : null}
                {session?.mode === "app" && session.authenticated ? (
                  <button
                    type="button"
                    onClick={() => startTransition(() => void logout())}
                    disabled={loggingOut}
                    className="rounded-full bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-500 transition-all duration-300 hover:bg-red-500/20 active:scale-95 disabled:opacity-40 xl:hidden"
                  >
                    {loggingOut ? "..." : "退出"}
                  </button>
                ) : null}
                {isLoginPage && (
                  <div className="rounded-full bg-[var(--accent)]/10 px-4 py-2 text-[10px] font-bold tracking-[0.1em] text-[var(--accent)] uppercase">
                    登录页
                  </div>
                )}
              </div>
            </div>

            {!isLoginPage && (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <nav className="-mx-1.5 flex snap-x gap-1.5 overflow-x-auto px-1.5 pb-1 sm:mx-0 sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0 scrollbar-none">
                  {navItems.map((item) => {
                    const active = item.match(pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-center text-[13px] font-bold transition-all duration-300 ease-out active:scale-95 sm:px-5 sm:py-2.5 sm:text-[14px] ${
                          active
                            ? "bg-[linear-gradient(135deg,#993c50,#c7576f)] text-white shadow-md shadow-[var(--accent)]/20"
                            : "text-[var(--muted)] hover:bg-[var(--foreground)]/5 hover:text-[var(--foreground)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {(session?.mode === "app" && session.authenticated) || session?.mode === "basic" ? (
                  <div className="hidden items-center gap-3 xl:ml-6 xl:flex xl:border-l xl:border-[var(--border)] xl:pl-6">
                    {session?.mode === "app" && session.authenticated && (
                      <>
                        <span className="hidden text-[12px] font-bold text-[var(--muted)] uppercase tracking-widest xl:inline">
                          账号：{session.username ?? "owner"}
                        </span>
                        <button
                          type="button"
                          onClick={() => startTransition(() => void logout())}
                          disabled={loggingOut}
                          className="rounded-full bg-red-500/10 px-5 py-2.5 text-[13px] font-bold text-red-500 transition-all duration-300 hover:bg-red-500/20 active:scale-95 disabled:opacity-40"
                        >
                          {loggingOut ? "..." : "退出"}
                        </button>
                      </>
                    )}
                    {session?.mode === "basic" && (
                      <span className="rounded-full bg-amber-500/10 px-4 py-2.5 text-[12px] font-bold text-amber-600 uppercase tracking-tight">
                        基础保护
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
