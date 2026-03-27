import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Quicksand, Nunito } from "next/font/google";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Longyu Chat",
    template: "%s | Longyu Chat",
  },
  description: "面向中文用户的多模型聊天室工作台，支持模型配置、顺序协作回复、历史续聊与移动端访问。",
  applicationName: "Longyu Chat",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Longyu Chat",
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
    <html lang="zh-CN" className={`${quicksand.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white">
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
