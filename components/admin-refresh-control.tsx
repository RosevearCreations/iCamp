"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function AdminRefreshControl({
  renderedAt,
  sectionKey,
}: Readonly<{
  renderedAt: string;
  sectionKey: string;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRequestedAt, setLastRequestedAt] = useState<string | null>(null);

  const renderedLabel = useMemo(
    () => new Date(renderedAt).toLocaleString(),
    [renderedAt],
  );

  function refresh() {
    setLastRequestedAt(new Date().toISOString());

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="refresh-control" data-section-key={sectionKey}>
      <div>
        <span className="refresh-control__label">Data freshness</span>
        <strong>{isPending ? "Refreshing…" : "Server view loaded"}</strong>
        <span>Rendered: {renderedLabel}</span>
        {lastRequestedAt ? (
          <span>
            Last refresh requested: {new Date(lastRequestedAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      <button
        className="refresh-button"
        disabled={isPending}
        onClick={refresh}
        type="button"
      >
        {isPending ? "Refreshing…" : "Refresh data"}
      </button>
    </div>
  );
}
