import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "잔잔한 가계부",
  description: "통장별 흐름을 조용히 정리하는 개인 가계부",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
