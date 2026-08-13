"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const SESSION_KEY = "quiet-ledger-opened";

export function LaunchOverview() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "true");
    if (pathname !== "/" && pathname !== "/login") router.replace("/");
  }, [pathname, router]);

  return null;
}
