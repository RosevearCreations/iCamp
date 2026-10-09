"use client";

import { useEffect, useState } from "react";

export function MapImagePreview({
  mediaAssetId,
  label,
}: Readonly<{
  mediaAssetId: string;
  label: string;
}>) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(
          `/api/media/${encodeURIComponent(mediaAssetId)}/access`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error("Preview unavailable.");
        }
        const payload = (await response.json()) as { url?: string };
        if (active && payload.url) {
          setUrl(payload.url);
        }
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [mediaAssetId]);

  if (failed) {
    return <div className="map-preview map-preview--empty">Preview unavailable</div>;
  }

  if (!url) {
    return <div className="map-preview map-preview--empty">Loading preview…</div>;
  }

  return (
    <div className="map-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Overhead map preview: ${label}`} />
    </div>
  );
}
