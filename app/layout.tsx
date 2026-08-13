import type { Metadata, Viewport } from "next";
import { LaunchOverview } from "@/components/launch-overview";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "잔잔한 가계부",
  description: "통장별 흐름을 조용히 정리하는 개인 가계부",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "잔잔한 가계부",
  },
  icons: {
    icon: "/pwa-192.png",
    apple: "/pwa-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#17191c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        <LaunchOverview />
        {children}
      </body>
    </html>
  );
}
