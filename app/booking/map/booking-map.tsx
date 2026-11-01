"use client";

import { useEffect, useMemo, useState } from "react";

import { publicMapPolygonPoints } from "@/lib/public-booking-map/core.mjs";
import type { PublicBookingMapItem } from "@/lib/public-booking-map/postgres.mjs";
import { filterPublicWayfinding } from "@/lib/wayfinding/core.mjs";
import type { PublicWayfindingPoint } from "@/lib/wayfinding/core.mjs";

import styles from "./booking-map.module.css";

const toneLabels = {
  green: "Available",
  grey: "Unavailable",
  yellow: "Maintenance",
  red: "Closed",
} as const;

const amenityLabels: Record<string, string> = {
  pool: "Pool",
  washroom: "Washroom",
  dock: "Dock",
  building: "Building / hall",
};

export function PublicBookingMap({
  mediaAssetId,
  sourceWidth,
  sourceHeight,
  campgroundSlug,
  arrivalDate,
  departureDate,
  items,
  amenities,
}: Readonly<{
  mediaAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  campgroundSlug: string;
  arrivalDate: string;
  departureDate: string;
  items: PublicBookingMapItem[];
  amenities: PublicWayfindingPoint[];
}>) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    items.find((item) => item.selectable)?.accommodationId ?? null,
  );
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(
    null,
  );
  const [amenityQuery, setAmenityQuery] = useState("");
  const [amenityKind, setAmenityKind] = useState("all");

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
  const visibleAmenities = useMemo(
    () =>
      filterPublicWayfinding(amenities, {
        query: amenityQuery,
        kind: amenityKind,
      }),
    [amenities, amenityQuery, amenityKind],
  );
  const selectedAmenity =
    visibleAmenities.find((item) => item.id === selectedAmenityId) ?? null;

  function select(item: PublicBookingMapItem) {
    setSelectedId(item.accommodationId);
    setSelectedAmenityId(null);
    document
      .getElementById(`booking-map-list-${item.accommodationId}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function selectAmenity(item: PublicWayfindingPoint) {
    setSelectedAmenityId(item.id);
    setSelectedId(null);
    document
      .getElementById(`wayfinding-amenity-${item.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={styles.wayfindingExplorer}>
      <section
        aria-labelledby="wayfinding-heading"
        className={styles.wayfindingFilters}
      >
        <h3 id="wayfinding-heading">Campground amenity wayfinding</h3>
        <p>
          Browse staff-reviewed amenity points on the published overhead image.
          Accommodation availability filters do not hide amenity locations.
          <a href="#wayfinding"> Skip to the matched amenity list</a>.
        </p>
        <div className={styles.filterRow}>
          <label>
            Search amenities and landmark notes
            <input
              type="search"
              value={amenityQuery}
              onChange={(event) => setAmenityQuery(event.target.value)}
              placeholder="Search washrooms, pool, hall…"
            />
          </label>
          <label>
            Amenity type
            <select
              value={amenityKind}
              onChange={(event) => setAmenityKind(event.target.value)}
            >
              <option value="all">All published types</option>
              {Object.entries(amenityLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.routeNotice}>
          Map points are landmarks, not a verified walking/driving route. No
          distances, travel times, step-free paths or gate permissions are
          inferred. Check route suitability and current access with the
          campground office.
        </p>
      </section>
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
              {visibleAmenities.map((item) => (
                <circle
                  key={item.id}
                  cx={item.x}
                  cy={item.y}
                  r={Math.max(sourceWidth, sourceHeight) * 0.012}
                  className={`${styles.amenityMarker} ${selectedAmenityId === item.id ? styles.amenitySelected : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedAmenityId === item.id}
                  aria-label={`${amenityLabels[item.kind] ?? item.kind}: ${item.name}. ${item.description}`}
                  onClick={() => selectAmenity(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectAmenity(item);
                    }
                  }}
                >
                  <title>{item.name}</title>
                </circle>
              ))}
            </svg>
          </div>
        </div>

        <aside className={styles.selection} aria-live="polite">
          <span className={styles.selectionLabel}>Selected map location</span>
          {selectedAmenity ? (
            <>
              <strong>{selectedAmenity.name}</strong>
              <span>
                {amenityLabels[selectedAmenity.kind] ?? selectedAmenity.kind} ·{" "}
                {selectedAmenity.code}
              </span>
              <p>{selectedAmenity.description}</p>
              <span>
                <b>Access information:</b>{" "}
                {selectedAmenity.accessibilityNote ||
                  "Not supplied; ask campground staff."}
              </span>
              <span>
                <b>Landmark guidance:</b>{" "}
                {selectedAmenity.landmarkHint || "No route guidance supplied."}
              </span>
            </>
          ) : selected ? (
            <>
              <strong>
                {selected.code} · {selected.displayName}
              </strong>
              <span>{selected.accommodationKind.replaceAll("_", " ")}</span>
              <span>
                Status: <b>{selected.label}</b>
              </span>
              {selected.selectable ? (
                ["campsite", "rental_cottage"].includes(
                  selected.accommodationKind,
                ) ? (
                  <a
                    href={`/booking/accommodations/${encodeURIComponent(
                      selected.accommodationId,
                    )}?campground=${encodeURIComponent(
                      campgroundSlug,
                    )}&arrivalDate=${encodeURIComponent(
                      arrivalDate,
                    )}&departureDate=${encodeURIComponent(departureDate)}`}
                  >
                    View campsite / cottage details →
                  </a>
                ) : (
                  <span>
                    Available for these dates. Detailed booking for this
                    accommodation type is not part of Build 038.
                  </span>
                )
              ) : (
                <span>
                  This accommodation cannot be selected for these dates.
                </span>
              )}
            </>
          ) : (
            <span>Select a location or use the accessible lists below.</span>
          )}
        </aside>
      </div>
      <section
        id="wayfinding"
        aria-labelledby="wayfinding-list-heading"
        className={styles.wayfindingList}
      >
        <h3 id="wayfinding-list-heading">
          Published amenity list ({visibleAmenities.length})
        </h3>
        {visibleAmenities.length === 0 ? (
          <p role="status">
            {amenities.length === 0
              ? "No campground-reviewed amenities have been published on this map yet. Ask the office for current facilities and directions."
              : "No published amenities match this search. Clear the search or choose another type."}
          </p>
        ) : (
          <ul className={styles.amenityList}>
            {visibleAmenities.map((item) => (
              <li
                id={`wayfinding-amenity-${item.id}`}
                key={item.id}
                className={styles.amenityCard}
              >
                <button
                  type="button"
                  className={styles.amenitySelect}
                  onClick={() => selectAmenity(item)}
                  aria-pressed={selectedAmenityId === item.id}
                >
                  {item.name}{" "}
                  <span>
                    · {amenityLabels[item.kind] ?? item.kind} ({item.code})
                  </span>
                </button>
                <p>{item.description}</p>
                <p>
                  <strong>Advertised accessibility:</strong>{" "}
                  {item.accessibilityNote ||
                    "Not supplied; confirm with staff."}
                </p>
                <p>
                  <strong>Landmark notes:</strong>{" "}
                  {item.landmarkHint || "No route guidance provided."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
