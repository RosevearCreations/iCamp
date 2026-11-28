"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

export function SiteWorkRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function refresh() {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    }
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [router, startTransition]);

  return (
    <p role="status">
      {pending
        ? "Requesting a fresh server view…"
        : "Automatic refresh requested every 30 seconds while online and visible."}
    </p>
  );
}
