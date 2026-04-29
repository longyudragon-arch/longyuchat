"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const chatSectionItems = [
  {
    href: "/rooms",
    label: "房间列表",
    match: (pathname: string) =>
      pathname === "/rooms" || /^\/rooms\/(?!new(?:\/|$))[^/]+(?:\/edit)?$/.test(pathname),
  },
  {
    href: "/rooms/new",
    label: "新建房间",
    match: (pathname: string) => pathname === "/rooms/new",
  },
  {
    href: "/models",
    label: "模型管理",
    match: (pathname: string) => pathname.startsWith("/models"),
  },
];

export function ChatSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="ly-chat-action-tabs" aria-label="AI聊天室二级导航">
      {chatSectionItems.map((item) => {
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`ly-chat-action-tab ${active ? "ly-chat-action-tab-active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
