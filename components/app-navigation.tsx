"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首页", match: (pathname: string) => pathname === "/" },
  { href: "/models", label: "模型管理", match: (pathname: string) => pathname.startsWith("/models") },
  { href: "/rooms", label: "房间列表", match: (pathname: string) => pathname.startsWith("/rooms") },
  { href: "/rooms/new", label: "新建房间", match: (pathname: string) => pathname === "/rooms/new" },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(246,244,238,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/" className="text-base font-semibold tracking-tight sm:text-lg">
            AI Chat Lab
          </Link>
          <p className="mt-1 hidden max-w-2xl text-sm text-[var(--muted)] sm:block">
            把模型配置、建房和聊天拆成独立页面后，结构会更清晰，也更方便继续扩展。
          </p>
        </div>

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
      </div>
    </header>
  );
}
