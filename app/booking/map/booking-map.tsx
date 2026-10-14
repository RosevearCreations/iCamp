"use client";

import { useEffect, useMemo, useState } from "react";

import { publicMapPolygonPoints } from "@/lib/public-booking-map/core.mjs";
import type { PublicBookingMapItem } from "@/lib/public-booking-map/postgres.mjs";

import styles from "./booking-map.module.css";

const toneLabels = {
  green: "Available",
  grey: "Unavailable",
  yellow: "Maintenance",
  red: "Closed",
} as const;

export function PublicBookingMap({
  mediaAssetId,
  sourceWidth,
  sourceHeight,
  items,
}: Readonly<{
  mediaAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  items: PublicBookingMapItem[];
}>) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    items.find((item) => item.selectable)?.accommodationId ?? null,
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(
          `/api/media/${encodeURIComponent(mediaAssetId)}/access`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Map image unavailable.");
        const payload = (await response.json()) as { url?: string };
        if (!payload.url) throw new Error("Map image unavailable.");
        if (active) setImageUrl(payload.url);
      } catch {
        if (active) setImageFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [mediaAssetId]);

  const selected = useMemo(
    () => items.find((item) => item.accommodationId === selectedId) ?? null,
    [items, selectedId],
  );

  function select(item: PublicBookingMapItem) {
    setSelectedId(item.accommodationId);
    document
      .getElementById(`booking-map-list-${item.accommodationId}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={styles.layout}>
      <div>
        <div className={styles.legend} aria-label="Map legend">
          {(Object.keys(toneLabels) as Array<keyof typeof toneLabels>).map(
            (tone) => (
              <span key={tone}>
                <span
                  className={`${styles.swatch} ${styles[`tone_${tone}`]}`}
                  aria-hidden="true"
                />
                {toneLabels[tone]}
              </span>
            ),
          )}
        </div>

        <div
          className={styles.viewport}
          aria-label="Interactive accommodation booking map"
        >
          {imageFailed ? (
            <p className={styles.imageNotice}>
              The published overhead image is temporarily unavailable. Polygon
              positions and booking status remain current.
            </p>
          ) : null}
          <svg
            className={styles.map}
            viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}
            role="group"
            aria-label="Selectable accommodation polygons"
          >
            {imageUrl ? (
              <image
                href={imageUrl}
                x="0"
                y="0"
                width={sourceWidth}
                height={sourceHeight}
                preserveAspectRatio="none"
              />
            ) : (
              <rect
                x="0"
                y="0"
                width={sourceWidth}
                height={sourceHeight}
                className={styles.fallbackBackground}
              />
            )}
            {items.map((item) => (
              <polygon
                key={item.accommodationId}
                points={publicMapPolygonPoints(item.geometry)}
                className={[
                  styles.polygon,
                  styles[`tone_${item.tone}`],
                  selectedId === item.accommodationId ? styles.selected : "",
                  item.selectable ? styles.selectable : styles.disabled,
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === item.accommodationId}
                aria-label={`${item.code} ${item.displayName}: ${item.label}`}
                onClick={() => select(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(item);
                  }
                }}
              />
            ))}
          </svg>
        </div>
      </div>

      <aside className={styles.selection} aria-live="polite">
        <span className={styles.selectionLabel}>Selected accommodation</span>
        {selected ? (
          <>
            <strong>
              {selected.code} · {selected.displayName}
            </strong>
            <span>{selected.accommodationKind.replaceAll("_", " ")}</span>
            <span>
              Status: <b>{selected.label}</b>
            </span>
            {selected.selectable ? (
              <span>
                Available for these dates. Build 038 will add the full
                campsite/cottage detail and booking step.
              </span>
            ) : (
              <span>
                This accommodation cannot be selected for these dates.
              </span>
            )}
          </>
        ) : (
          <span>Select a polygon or use the accessible list below.</span>
        )}
      </aside>
    </div>
  );
}
