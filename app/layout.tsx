import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LongyuChat",
    template: "%s | LongyuChat",
  },
  description: "面向中文用户的多模型聊天室工作台，支持模型配置、顺序协作回复、历史续聊与移动端访问。",
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
  themeColor: "#f9f5fc",
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
