"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { fetchJson } from "@/lib/client/longyuchat-client";
import type { AuthSessionView } from "@/types/app";

const navItems = [
  { href: "/", label: "首页", shortLabel: "首页", match: (p: string) => p === "/" },
  { href: "/daily", label: "AI 日报", shortLabel: "日报", match: (p: string) => p === "/daily" || p.startsWith("/daily/") },
  {
    href: "/rooms",
    label: "AI聊天室",
    shortLabel: "聊天",
    match: (p: string) =>
      p === "/rooms" || p.startsWith("/rooms/") || p.startsWith("/models"),
  },
  { href: "/projects", label: "项目推荐", shortLabel: "项目", match: (p: string) => p.startsWith("/projects") },
  { href: "/about", label: "个人简介", shortLabel: "简介", match: (p: string) => p.startsWith("/about") },
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
    <header className="ly-app-header sticky top-0 z-50 px-0 pb-2 pt-3 sm:pt-4">
      <div className="ly-shell">
        <div className="ly-app-nav ly-glass flex items-center justify-between gap-3 rounded-[1.35rem] px-3 py-2 sm:px-4">
          <Link href="/" className="group inline-flex shrink-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/70 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/portal/feather-logo-transparent.png"
                alt=""
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            <span className="hidden text-[15px] font-display font-bold tracking-tight text-[var(--foreground)] sm:block">
              LongyuChat
            </span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none sm:gap-1.5">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`ly-nav-item shrink-0 ${
                    active
                      ? "ly-nav-item-active"
                      : "ly-nav-item-idle"
                  }`}
                >
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {session?.mode === "app" && session.authenticated && (
              <>
                <span className="hidden text-[11px] font-bold tracking-wide text-[var(--muted)] xl:inline">
                  {session.username ?? "owner"}
                </span>
                <button
                  type="button"
                  onClick={() => startTransition(() => void logout())}
                  disabled={loggingOut}
                  className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-500 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-40"
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
