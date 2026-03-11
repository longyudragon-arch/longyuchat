"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { fetchJson } from "@/lib/client/chat-lab-client";
import type { AuthSessionView } from "@/types/app";

const navItems = [
  { href: "/", label: "首页", match: (pathname: string) => pathname === "/" },
  { href: "/models", label: "模型管理", match: (pathname: string) => pathname.startsWith("/models") },
  { href: "/rooms", label: "会话空间", match: (pathname: string) => pathname.startsWith("/rooms") },
  { href: "/rooms/new", label: "新建房间", match: (pathname: string) => pathname === "/rooms/new" },
];

function BrandBlock() {
  return (
    <div>
      <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
        Longyu Chat
      </Link>
      <p className="mt-1 hidden max-w-2xl text-sm text-[var(--muted)] sm:block">
        Multi-model conversations for personal research, side-by-side thinking, and clean deployment.
      </p>
    </div>
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

  if (pathname === "/login") {
    return (
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(246,244,238,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <BrandBlock />
          <span className="rounded-full border border-[rgba(166,73,36,0.16)] bg-[rgba(255,246,232,0.82)] px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[var(--accent-strong)]">
            SECURE ACCESS
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(246,244,238,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-5 sm:py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start justify-between gap-4">
          <BrandBlock />
          {session?.mode === "app" ? (
            <span className="mt-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-emerald-700">
              APP LOGIN
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <nav className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {navItems.map((item) => {
              const active = item.match(pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition sm:px-4 ${
                    active
                      ? "border-[var(--accent)] bg-[rgba(191,95,54,0.08)] text-[var(--accent-strong)]"
                      : "border-[var(--border)] bg-white/80 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
                <span className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-[var(--muted)]">
                  已登录：{session.username ?? "owner"}
                </span>
                <button
                  type="button"
                  onClick={() => startTransition(() => void logout())}
                  disabled={loggingOut}
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loggingOut ? "退出中..." : "退出登录"}
                </button>
              </>
            ) : null}

            {session?.mode === "basic" ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                Browser Basic Auth enabled
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
