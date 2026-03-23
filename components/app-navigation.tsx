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
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ffd0a8,#c35a2f)] text-[13px] font-bold text-white shadow-[0_12px_32px_rgba(195,90,47,0.2)] transition-transform group-hover:scale-105">
        LY
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold tracking-tight text-[var(--foreground)] sm:text-[17px]">
          Longyu Chat
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-bold tracking-[0.2em] text-[var(--muted)] opacity-50 uppercase">
          AI Workspace
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
    <header className="sticky top-0 z-40 px-3 pb-1 pt-3 sm:px-5 sm:pb-2 sm:pt-4">
      <div className="ly-shell">
        <div className="ly-glass overflow-hidden rounded-2xl px-4 py-3 sm:rounded-[2rem] sm:px-6 sm:py-4 shadow-[0_12px_40px_rgba(17,17,17,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-4">
              <BrandBlock />
              <div className="flex items-center gap-2">
                {session?.mode === "app" ? (
                  <span className="shrink-0 rounded-full bg-[var(--navy)]/5 px-2.5 py-1 text-[9px] font-bold tracking-[0.15em] text-[var(--navy)] uppercase border border-[var(--navy)]/10">
                    Secure
                  </span>
                ) : null}
                {isLoginPage && (
                  <div className="rounded-full bg-[var(--accent)]/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] text-[var(--accent)] uppercase">
                    Login
                  </div>
                )}
              </div>
            </div>

            {!isLoginPage && (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <nav className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
                  {navItems.map((item) => {
                    const active = item.match(pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`shrink-0 snap-start whitespace-nowrap rounded-xl px-4 py-2 text-center text-[13px] font-bold transition-all active:scale-95 ${
                          active
                            ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20"
                            : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {(session?.mode === "app" && session.authenticated) || session?.mode === "basic" ? (
                  <div className="flex items-center gap-2 xl:ml-4 xl:border-l xl:border-[var(--border)] xl:pl-4">
                    {session?.mode === "app" && session.authenticated && (
                      <>
                        <span className="hidden text-[11px] font-bold text-[var(--muted)] opacity-60 uppercase tracking-wider xl:inline">
                          User: {session.username ?? "owner"}
                        </span>
                        <button
                          type="button"
                          onClick={() => startTransition(() => void logout())}
                          disabled={loggingOut}
                          className="rounded-xl bg-red-500/10 px-4 py-2 text-[12px] font-bold text-red-500 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-40"
                        >
                          {loggingOut ? "..." : "退出"}
                        </button>
                      </>
                    )}
                    {session?.mode === "basic" && (
                      <span className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-600 uppercase tracking-tight">
                        Basic Auth
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
