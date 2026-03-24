"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { fetchJson } from "@/lib/client/chat-lab-client";
import type { AuthSessionView } from "@/types/app";

const navItems = [
  { href: "/", label: "首页", match: (p: string) => p === "/" },
  { href: "/models", label: "模型", match: (p: string) => p.startsWith("/models") },
  {
    href: "/rooms",
    label: "房间",
    match: (p: string) =>
      p === "/rooms" || /^\/rooms\/(?!new(?:\/|$))[^/]+(?:\/edit)?$/.test(p),
  },
  { href: "/rooms/new", label: "新建", match: (p: string) => p === "/rooms/new" },
];

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

  // Hide nav on chat pages and login page
  const isChatPage = /^\/rooms\/[^/]+$/.test(pathname) && pathname !== "/rooms/new";
  const isLoginPage = pathname === "/login";
  if (isChatPage || isLoginPage) return null;

  return (
    <header className="sticky top-0 z-40 px-0 pt-2 pb-1.5 sm:pt-3 sm:pb-2">
      <div className="ly-shell">
        <div className="ly-glass flex items-center justify-between gap-3 rounded-2xl px-3 py-2 sm:rounded-[1.25rem] sm:px-5 sm:py-2.5">
          {/* Brand */}
          <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 group">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f48498,#993c50)] text-[11px] font-display font-bold text-white shadow-md shadow-[var(--accent)]/25 transition-transform duration-300 group-hover:scale-105 sm:h-9 sm:w-9 sm:text-[12px]">
              LY
            </span>
            <span className="hidden text-[15px] font-display font-bold tracking-tight text-[var(--foreground)] sm:block">
              Longyu Chat
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ly-nav-item shrink-0 ${
                    active
                      ? "ly-nav-item-active"
                      : "ly-nav-item-idle"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Session info */}
          <div className="flex shrink-0 items-center gap-2">
            {session?.mode === "app" && session.authenticated && (
              <>
                <span className="hidden text-[11px] font-bold text-[var(--muted)] tracking-wide xl:inline">
                  {session.username ?? "owner"}
                </span>
                <button
                  type="button"
                  onClick={() => startTransition(() => void logout())}
                  disabled={loggingOut}
                  className="ly-secondary-action rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500/20 active:scale-95 disabled:opacity-40"
                >
                  {loggingOut ? "..." : "退出"}
                </button>
              </>
            )}
            {session?.mode === "basic" && (
              <span className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 tracking-tight">
                基础保护
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
