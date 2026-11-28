"use client";

import { useEffect, useState } from "react";

import type { summarizeSiteWork285 } from "@/lib/build285/site-work.mjs";
import { publicMapPolygonPoints } from "@/lib/public-booking-map/core.mjs";
import type {
  getPublicBookingMapSnapshot,
  PublicBookingMapItem,
} from "@/lib/public-booking-map/postgres.mjs";

type Snapshot = Awaited<ReturnType<typeof getPublicBookingMapSnapshot>>;
type Rows = ReturnType<typeof summarizeSiteWork285>;

export function SiteWorkMap({
  map,
  items,
  rows,
}: Readonly<{ map: Snapshot["map"]; items: PublicBookingMapItem[]; rows: Rows }>) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(
          `/api/media/${encodeURIComponent(map.mediaAssetId)}/access`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as { url?: string };
        if (!response.ok || !payload.url) throw Error("Image unavailable");
        if (active) setUrl(payload.url);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [map.mediaAssetId]);

  const plotted = items.flatMap((item) => {
    const site = rows.find((row) => row.id === item.accommodationId);
    if (!site) return [];
    try {
      const points = publicMapPolygonPoints(item.geometry);
      if (!points) return [];
      const first = item.geometry.vertices[0].image;
      return [{ site, points, first }];
    } catch {
      return [];
    }
  });
  const scale = Math.max(map.sourceWidth, map.sourceHeight) / 100;
  return (
    <>
      <p>
        Version {map.versionNumber} · Orange A: open assistance · Purple F:
        open add-on work. Blue: occupied · Red: closed or winterized. A
        question mark means unknown. Select a polygon to open its list entry.
      </p>
      {failed ? (
        <p role="status">
          Overhead image unavailable. Published polygons and list remain
          available; do not infer terrain or routes.
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${map.sourceWidth} ${map.sourceHeight}`}
        style={{ width: "100%", maxHeight: "70vh", background: "#20382e" }}
        role="group"
        aria-label="Published campsite service indicators"
      >
        {url ? (
          <image
            href={url}
            width={map.sourceWidth}
            height={map.sourceHeight}
            preserveAspectRatio="none"
          />
        ) : null}
        {plotted.map(({ site, points, first }) => {
          const fill = ["closed", "winterized"].includes(site.operatingState)
            ? "#b52c36"
            : site.assistance && site.assistance > 0
              ? "#d87820"
              : site.operatingState === "occupied"
                ? "#2362b5"
                : "#455e54";
          const label = `${site.code}: ${site.operatingState}; assistance ${site.assistance ?? "unknown"}; add-on work ${site.fulfillment ?? "unknown"}`;
          return (
            <a
              key={site.id}
              href={`#site-work-${site.id}`}
              aria-label={label}
            >
              <title>{label}</title>
              <polygon
                points={points}
                fill={fill}
                fillOpacity="0.75"
                stroke="white"
                strokeWidth={scale * 0.18}
              />
              <text
                x={first.x}
                y={first.y + scale * 1.5}
                fontSize={scale * 1.5}
                fill="white"
                stroke="#14221d"
                strokeWidth={scale * 0.12}
                paintOrder="stroke"
              >
                {site.code} A:{site.assistance ?? "?"}
              </text>
              <text
                x={first.x}
                y={first.y + scale * 3.2}
                fontSize={scale * 1.5}
                fill="#e0bcff"
                stroke="#24123c"
                strokeWidth={scale * 0.12}
                paintOrder="stroke"
              >
                F:{site.fulfillment ?? "?"}
              </text>
            </a>
          );
        })}
      </svg>
      <p>
        {plotted.length} of {rows.length} active accommodations plotted. Every
        returned site remains in the list, including unplotted sites.
      </p>
    </>
  );
}
