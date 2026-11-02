"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());
  const refreshed = useRef(false);
  const remaining = Math.max(0, Math.ceil((target - now) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [remaining, router]);

  return (
    <span aria-live="polite" data-expired={remaining === 0 ? "true" : "false"}>
      {remaining === 0 ? "Expired" : formatRemaining(remaining)}
    </span>
  );
}
