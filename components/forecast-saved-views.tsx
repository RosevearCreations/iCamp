"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CapacityForecastVariance } from "@/lib/command-centre/capacity-forecast-core.mjs";
import {
  FORECAST_SAVED_LIMIT,
  parseSavedForecastViews,
  serializeSavedForecastViews,
  upsertSavedForecastView,
  type SavedForecastView,
} from "@/lib/command-centre/forecast-saved-views-core.mjs";

type Snapshot = Pick<
  CapacityForecastVariance,
  "lookbackMonths" | "scenario" | "generatedAt"
> & { total: CapacityForecastVariance["total"] };

export function ForecastSavedViews({
  campgroundId,
  userId,
  current,
  comparisons,
}: {
  campgroundId: string;
  userId: string;
  current: Pick<CapacityForecastVariance, "lookbackMonths" | "scenario">;
  comparisons: Snapshot[];
}) {
  const key = `icamp:forecast-saved:v1:${userId}:${campgroundId}`;
  const [views, setViews] = useState<SavedForecastView[]>([]);
  const [label, setLabel] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setViews(parseSavedForecastViews(window.localStorage.getItem(key)));
        setMessage("");
      } catch {
        setViews([]);
        setMessage(
          "Browser storage is unavailable; saved views cannot be retained.",
        );
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  const write = (updated: SavedForecastView[]) => {
    try {
      window.localStorage.setItem(key, serializeSavedForecastViews(updated));
      setViews(updated);
      setMessage(
        "Saved in this browser only. Historical figures are recalculated from the current authorized source.",
      );
    } catch {
      setMessage(
        "Unable to save in this browser. Your existing views were not changed.",
      );
    }
  };

  const selectedKey = `${current.lookbackMonths}:${current.scenario}`;
  const linkFor = (view: SavedForecastView) =>
    `/workspaces/management/command/forecast?campground=${encodeURIComponent(campgroundId)}&window=${view.lookbackMonths}&scenario=${view.scenario}`;

  return (
    <section
      className="content-panel ops-detail-card camp-forecast__saved"
      aria-labelledby="saved-forecast-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Build 167 · Browser-local preferences</p>
          <h2 id="saved-forecast-heading">Saved scenario comparison views</h2>
        </div>
        <span className="ops-pill">
          {loaded ? views.length : "…"} / {FORECAST_SAVED_LIMIT} saved
        </span>
      </div>
      <p className="ops-inline-note">
        Save a named window/scenario combination for this signed-in user and
        campground on this browser. Only the name and filter choices are stored
        locally—never booking counts. Comparisons below use this page&apos;s
        newly read, campground-authorized historical records; they are not
        predictions or shared presets.
      </p>
      <form
        className="camp-forecast__save-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            write(upsertSavedForecastView(views, { label, ...current }));
            setLabel("");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to save this view.",
            );
          }
        }}
      >
        <label htmlFor="saved-forecast-name">
          Name this view
          <input
            id="saved-forecast-name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={48}
            required
            placeholder="Example: High-rate 5-month review"
          />
        </label>
        <button type="submit" className="secondary-button" disabled={!loaded}>
          Save selected scenario
        </button>
      </form>
      {message ? (
        <p role="status" className="ops-inline-note">
          {message}
        </p>
      ) : null}
      {!loaded ? (
        <p role="status">Loading saved views from this browser…</p>
      ) : views.length ? (
        <div className="camp-occupancy__table-scroll">
          <table className="camp-occupancy__table camp-forecast__saved-table">
            <caption>
              Current source comparison of saved historical-rate scenarios; site
              nights
            </caption>
            <thead>
              <tr>
                <th scope="col">Saved view</th>
                <th scope="col">Estimate</th>
                <th scope="col">Actual − estimate</th>
                <th scope="col">Comparable types</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {views.map((view) => {
                const snapshot = comparisons.find(
                  (item) =>
                    item.lookbackMonths === view.lookbackMonths &&
                    item.scenario === view.scenario,
                );
                return (
                  <tr key={view.key}>
                    <th scope="row">
                      {view.label}
                      <small>
                        {view.lookbackMonths} months · {view.scenario}
                        {view.key === selectedKey ? " · selected" : ""}
                      </small>
                    </th>
                    <td>
                      {snapshot
                        ? snapshot.total.expectedNights.toLocaleString("en-CA")
                        : "Unavailable"}
                    </td>
                    <td>
                      {snapshot
                        ? `${snapshot.total.varianceNights > 0 ? "+" : ""}${snapshot.total.varianceNights.toLocaleString("en-CA")}`
                        : "—"}
                    </td>
                    <td>
                      {snapshot ? `${snapshot.total.comparableKinds} / 3` : "—"}
                    </td>
                    <td className="camp-forecast__saved-actions">
                      <Link href={linkFor(view)}>Open ↗</Link>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          write(views.filter((item) => item.key !== view.key))
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ops-inline-note">
          No local saved views yet. Choose scenario filters above, name the
          selection, and save it here.
        </p>
      )}
      <p className="ops-inline-note">
        An unavailable source remains unavailable; no saved number is
        substituted. Clearing browser storage removes these view preferences.
      </p>
    </section>
  );
}
