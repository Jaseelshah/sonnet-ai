"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

/**
 * Wraps children in AppShell (sidebar + layout) for all routes except /login.
 * The login page is rendered standalone so it has no navigation chrome.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
