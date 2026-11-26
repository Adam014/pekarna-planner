"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 60_000;

/**
 * Online orders and other staff change the list during the day, so it reloads
 * from the server every minute while the tab is visible, and when the tab
 * becomes visible again.
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refreshIfVisible, INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);
  return null;
}
