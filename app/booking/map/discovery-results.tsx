"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SectionHeading } from "@/components/section-heading";
import {
  parsePublicComparison,
  recheckPublicComparison,
  savePublicComparison,
} from "@/lib/public-booking-map/discovery.mjs";
import type { SavedPublicComparison } from "@/lib/public-booking-map/discovery.mjs";
import type { PublicBookingMapItem } from "@/lib/public-booking-map/postgres.mjs";

import { PublicBookingMap } from "./booking-map";
import styles from "./discovery-results.module.css";

interface Context {
  campgroundSlug: string;
  arrivalDate: string;
  departureDate: string;
}

function detailHref(item: PublicBookingMapItem, context: Context) {
  const query = new URLSearchParams({
    campground: context.campgroundSlug,
    arrivalDate: context.arrivalDate,
    departureDate: context.departureDate,
  });
  return `/booking/accommodations/${encodeURIComponent(item.accommodationId)}?${query.toString()}`;
}

function humanize(value: string | null) {
  return value ? value.replaceAll("_", " ") : "Not supplied";
}

function factBool(value: boolean | null) {
  return value === null ? "Not supplied" : value ? "Yes" : "No";
}

function comparisonRows(item: PublicBookingMapItem) {
  const d = item.discovery;
  return [
    item.label + (item.selectable ? " · selectable" : " · not selectable"),
    humanize(item.accommodationKind),
    humanize(d.campsiteType),
    humanize(d.serviceLevel),
    d.maxOccupancy === null
      ? "Not supplied (campsite occupancy not verified)"
      : String(d.maxOccupancy),
    d.petsAllowed === null
      ? "Not supplied"
      : d.petsAllowed
        ? `Up to ${d.maxPets} pets`
        : "Not allowed",
    d.maxRvLengthMeters === null ? "Not supplied" : `${d.maxRvLengthMeters} m`,
    factBool(d.accessibleSite),
    factBool(d.stepFreeAccess),
    factBool(d.accessibleWashroom),
    d.electricalAmperage === null
      ? "Not supplied"
      : d.electricalAmperage
        ? `${d.electricalAmperage} amp`
        : "None",
    humanize(d.waterService),
    humanize(d.wifiService),
    factBool(d.isWaterfront),
    factBool(d.pullThrough),
    factBool(d.hasFireRing),
    factBool(d.hasPicnicTable),
    `${d.photoCount} published (${d.describedPhotoCount} described)`,
  ];
}

const comparisonLabels = [
  "Live booking status",
  "Accommodation",
  "Campsite type",
  "Service level",
  "Maximum guests",
  "Pets",
  "Maximum RV length",
  "Advertised accessible campsite",
  "Cottage step-free access",
  "Cottage accessible washroom",
  "Electricity",
  "Water",
  "Wi-Fi",
  "Waterfront",
  "Pull-through",
  "Fire ring",
  "Picnic table",
  "Gallery photos with alternative text",
];

export function DiscoveryResults({
  allItems,
  visibleItems,
  map,
  context,
  generatedAt,
}: Readonly<{
  allItems: PublicBookingMapItem[];
  visibleItems: PublicBookingMapItem[];
  map: {
    mediaAssetId: string;
    sourceWidth: number;
    sourceHeight: number;
    versionNumber: number;
  };
  context: Context;
  generatedAt: string;
}>) {
  const storageKey = `icamp:public-discovery:comparison:v1:${context.campgroundSlug}`;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedPublicComparison | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Restore after hydration from an external browser callback.
    const frame = window.requestAnimationFrame(() => {
      try {
        const restored = parsePublicComparison(
          window.localStorage.getItem(storageKey),
          context.campgroundSlug,
        );
        setSaved(restored);
        setSelectedIds(restored?.entries.map((entry) => entry.id) ?? []);
        setNotice(
          restored
            ? "Saved comparison restored and checked against this page's live snapshot."
            : "",
        );
      } catch {
        setSaved(null);
        setSelectedIds([]);
        setNotice(
          "Local comparison storage is unavailable. You can still compare during this visit.",
        );
      }
      setLoadedKey(storageKey);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey, context.campgroundSlug]);

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) return current.filter((candidate) => candidate !== id);
      if (current.includes(id)) return current;
      if (current.length >= 3) return current;
      return [...current, id];
    });
    if (checked && selectedIds.length >= 3 && !selectedIds.includes(id)) {
      setNotice(
        "Compare up to three campsites or cottages. Remove one before adding another.",
      );
    } else {
      setNotice(
        "Comparison selection changed. Choose Save comparison to keep it on this device.",
      );
    }
  }

  function saveSelection() {
    const selected = selectedIds
      .map((id) => allItems.find((item) => item.accommodationId === id))
      .filter((item): item is PublicBookingMapItem => Boolean(item));
    if (selected.length !== selectedIds.length || selected.length === 0) {
      setNotice(
        "An earlier selection is no longer published. Remove it before saving a fresh comparison.",
      );
      return;
    }
    try {
      const record = savePublicComparison(selected, context);
      window.localStorage.setItem(storageKey, JSON.stringify(record));
      setSaved(record);
      setNotice(
        "Comparison saved on this device. Availability and source details will be checked again on your next visit.",
      );
    } catch {
      setNotice(
        "Unable to save this comparison. Browser storage may be disabled.",
      );
    }
  }

  function clearSelection() {
    setSelectedIds([]);
    setSaved(null);
    try {
      window.localStorage.removeItem(storageKey);
      setNotice("Saved comparison cleared from this device.");
    } catch {
      setNotice("Selection cleared. Browser storage could not be updated.");
    }
  }

  const rechecked = saved
    ? recheckPublicComparison(saved, allItems, context)
    : null;
  const missingSaved = rechecked?.entries.filter((entry) => !entry.item) ?? [];
  const changedSaved =
    rechecked?.entries.filter((entry) => entry.changed) ?? [];
  const comparisonItems = selectedIds
    .map((id) => allItems.find((item) => item.accommodationId === id))
    .filter((item): item is PublicBookingMapItem =>
      Boolean(
        item && ["campsite", "rental_cottage"].includes(item.accommodationKind),
      ),
    );
  const isLoaded = loadedKey === storageKey;

  return (
    <>
      <section className="content-panel" aria-labelledby="booking-map-title">
        <SectionHeading
          eyebrow="Published campground map"
          title="Live discovery map"
          id="booking-map-title"
          helpTopic="shell.overview"
          trailing={
            <span className="build-chip">
              Published map v{map.versionNumber}
            </span>
          }
        />
        <PublicBookingMap
          mediaAssetId={map.mediaAssetId}
          sourceWidth={map.sourceWidth}
          sourceHeight={map.sourceHeight}
          campgroundSlug={context.campgroundSlug}
          arrivalDate={context.arrivalDate}
          departureDate={context.departureDate}
          items={visibleItems}
        />
        <p>
          Availability checked at{" "}
          <time dateTime={generatedAt}>
            {new Date(generatedAt).toUTCString()}
          </time>
          . Refresh to re-read reservations, temporary holds, management
          restrictions, turnover and seasonal assignments. A green result is not
          a reservation or hold.
        </p>
      </section>

      <section
        className="content-panel"
        id="booking-map-list"
        aria-labelledby="booking-list-title"
      >
        <SectionHeading
          eyebrow="Keyboard and screen-reader equivalent"
          title={`Filtered accommodation list (${visibleItems.length})`}
          id="booking-list-title"
          helpTopic="shell.overview"
        />
        <p>
          Map and list share identical, date-checked results. Mark up to three
          published campsites or cottages for a comparison below; unavailable
          units remain visible unless you choose Available only.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Compare</th>
                <th scope="col">Accommodation</th>
                <th scope="col">Type / accessibility</th>
                <th scope="col">Pet / vehicle fit</th>
                <th scope="col">Live status</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const comparable = ["campsite", "rental_cottage"].includes(
                  item.accommodationKind,
                );
                const checked = selectedIds.includes(item.accommodationId);
                return (
                  <tr
                    key={item.accommodationId}
                    id={`booking-map-list-${item.accommodationId}`}
                  >
                    <td>
                      {comparable ? (
                        <label className={styles.compareLabel}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              !isLoaded || (!checked && selectedIds.length >= 3)
                            }
                            onChange={(event) =>
                              toggleSelection(
                                item.accommodationId,
                                event.target.checked,
                              )
                            }
                          />
                          <span className={styles.srOnly}>
                            Compare {item.code} {item.displayName}
                          </span>
                        </label>
                      ) : (
                        "Not in scope"
                      )}
                    </td>
                    <td>
                      <strong>
                        {item.code} · {item.displayName}
                      </strong>
                      {comparable ? (
                        <div>
                          <Link href={detailHref(item, context)}>
                            View details, photos and policies
                          </Link>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {humanize(
                        item.discovery.campsiteType ?? item.accommodationKind,
                      )}
                      <div className={styles.muted}>
                        {item.discovery.accessibleSite
                          ? "Advertised accessible site"
                          : item.discovery.stepFreeAccess
                            ? "Step-free cottage"
                            : item.discovery.accessibleWashroom
                              ? "Accessible cottage washroom"
                              : "No accessibility feature attested here"}
                      </div>
                    </td>
                    <td>
                      {item.discovery.petsAllowed === null
                        ? "Pet policy not supplied"
                        : item.discovery.petsAllowed
                          ? `Up to ${item.discovery.maxPets} pets`
                          : "No pets"}
                      <div className={styles.muted}>
                        {item.discovery.maxRvLengthMeters === null
                          ? "RV length not supplied"
                          : `RV up to ${item.discovery.maxRvLengthMeters} m`}
                      </div>
                    </td>
                    <td>
                      <strong>{item.label}</strong>
                      <div className={styles.muted}>
                        {item.selectable
                          ? "Selectable for these dates"
                          : "Not selectable for these dates"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visibleItems.length === 0 ? (
          <p role="status">
            No published accommodations match these filters. Try removing one
            constraint or selecting different dates.
          </p>
        ) : null}
      </section>

      <section
        className="content-panel"
        id="discovery-compare"
        aria-labelledby="discovery-compare-title"
      >
        <SectionHeading
          eyebrow="Build 173 · Saved side-by-side view"
          title="Compare campsites and cottages"
          id="discovery-compare-title"
          helpTopic="shell.overview"
        />
        <p>
          Compare one to three accommodations using campground-maintained
          details. Saved selections stay in this browser only; they are not a
          reservation, payment, accessibility certification or promise of
          availability.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={saveSelection}
            disabled={
              !isLoaded || selectedIds.length === 0 || missingSaved.length > 0
            }
          >
            Save comparison ({selectedIds.length}/3)
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={clearSelection}
            disabled={!isLoaded || (selectedIds.length === 0 && !saved)}
          >
            Clear saved comparison
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => window.location.reload()}
          >
            Refresh live availability
          </button>
        </div>
        <p role="status" aria-live="polite" className={styles.notice}>
          {notice}
        </p>
        {saved ? (
          <div className={styles.savedNotice}>
            <strong>Saved {new Date(saved.savedAt).toUTCString()}</strong>
            <p>
              Original dates: {saved.arrivalDate} to {saved.departureDate}.
              Current dates: {context.arrivalDate} to {context.departureDate}.
            </p>
            {rechecked?.datesChanged ? (
              <p>
                Dates changed. All displayed statuses are recalculated for the
                current dates; re-save only after reviewing.
              </p>
            ) : null}
            {changedSaved.length > 0 ? (
              <p role="alert">
                {changedSaved.length} saved comparison item(s) changed, have
                different dates or are no longer published. Check current
                details before deciding.
              </p>
            ) : (
              <p>
                Saved sources match this page’s freshly checked snapshot.
                Availability can still change afterward.
              </p>
            )}
            {missingSaved.length > 0 ? (
              <p role="alert">
                {missingSaved.length} saved item(s) are no longer present in
                published results and cannot be compared or booked here. Clear
                to start again.
              </p>
            ) : null}
          </div>
        ) : null}
        {comparisonItems.length > 0 ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="Side-by-side campsite and cottage comparison"
            tabIndex={0}
          >
            <table className={styles.comparison}>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {comparisonItems.map((item) => (
                    <th scope="col" key={item.accommodationId}>
                      {item.code} · {item.displayName}
                      <div>
                        <Link href={detailHref(item, context)}>
                          Full details
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonLabels.map((label, index) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {comparisonItems.map((item) => (
                      <td key={item.accommodationId}>
                        {comparisonRows(item)[index]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Select accommodations from the list above. The comparison works with
            keyboard, touch and screen readers.
          </p>
        )}
        <p className={styles.muted}>
          Accessibility flags are campground-maintained descriptions, not
          independently verified accessibility assessments. An unreported
          feature is never treated as a positive match. For exact access needs,
          occupancy at campsites, vehicle exceptions or pet accommodations,
          confirm details with the campground before committing. Published photo
          counts indicate coverage, not photographic quality. Prices and total
          fee previews arrive in Build 174.
        </p>
      </section>
    </>
  );
}
