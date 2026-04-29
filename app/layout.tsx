import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LongyuChat",
    template: "%s | LongyuChat",
  },
  description: "LongyuChat 是面向中文用户的个人 AI 总站，聚合 AI 日报、多模型聊天室和模型管理工作流。",
  applicationName: "LongyuChat",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LongyuChat",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef4fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white">
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
