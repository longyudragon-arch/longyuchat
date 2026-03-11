import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Longyu Chat",
    template: "%s | Longyu Chat",
  },
  description: "Multi-model chat workspace for private deployment, side-by-side AI comparison, and mobile-friendly access.",
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
  themeColor: "#bf5f36",
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
      <body>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
