"use client";

import { useState } from "react";

import type { SegmentComparisonSummary } from "@/lib/command-centre/segment-comparison-core.mjs";

const names: Record<string, string> = {
  campsite: "Campsites",
  rental_cottage: "Rental cottages",
  permanent_unit: "Permanent units",
};

export function SegmentComparisonChart({
  summary,
}: {
  summary: SegmentComparisonSummary;
}) {
  const [range, setRange] = useState<3 | 6>(6);
  const [segment, setSegment] = useState("all");
  const months = summary.months.slice(-range);
  const visible = summary.segments
    .filter((item) => segment === "all" || item.kind === segment)
    .map((item) => {
      const selected = item.months.filter((row) => months.includes(row.month));
      const siteNights = selected.reduce(
        (count, row) => count + row.siteNights,
        0,
      );
      const bookedNights = selected.reduce(
        (count, row) => count + row.bookedNights,
        0,
      );
      return {
        ...item,
        siteNights,
        bookedNights,
        seasonalNights: selected.reduce(
          (count, row) => count + row.seasonalNights,
          0,
        ),
        reservationNights: selected.reduce(
          (count, row) => count + row.reservationNights,
          0,
        ),
        bookedPercent: siteNights
          ? Math.round((bookedNights / siteNights) * 100)
          : 0,
      };
    });
  return (
    <section
      className="content-panel ops-detail-card camp-segments"
      aria-labelledby="segment-chart-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Inventory mix · Reservation coverage</p>
          <h2 id="segment-chart-title">Compare accommodation segments</h2>
        </div>
        <div
          className="camp-occupancy__range"
          role="group"
          aria-label="Comparison date range"
        >
          <button
            type="button"
            aria-pressed={range === 3}
            onClick={() => setRange(3)}
          >
            3 months
          </button>
          <button
            type="button"
            aria-pressed={range === 6}
            onClick={() => setRange(6)}
          >
            6 months
          </button>
        </div>
      </div>
      <p className="camp-occupancy__explanation">
        Showing {range} months, including the current partial month. Booked
        percentages compare each accommodation type to its own active site-night
        inventory. Green bars show unique booked coverage; seasonal assignment
        nights may overlap reservation nights. Earlier site inventory uses
        today&apos;s active sites.
      </p>
      <label className="camp-segments__filter">
        Accommodation type
        <select
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
        >
          <option value="all">All three types</option>
          {summary.segments.map((item) => (
            <option key={item.kind} value={item.kind}>
              {names[item.kind]}
            </option>
          ))}
        </select>
      </label>
      <div className="camp-segments__grid">
        {visible.map((item) => (
          <article className="camp-segments__card" key={item.kind}>
            <div className="ops-section-heading">
              <h3>{names[item.kind]}</h3>
              <strong>{item.bookedPercent}%</strong>
            </div>
            <div className="camp-segments__meter" aria-hidden="true">
              <span style={{ width: `${item.bookedPercent}%` }} />
            </div>
            <p>
              {item.bookedNights.toLocaleString("en-CA")} booked site nights /{" "}
              {item.siteNights.toLocaleString("en-CA")} inventory site nights
            </p>
            <small>
              {item.seasonalNights.toLocaleString("en-CA")} seasonal assignment
              nights, {item.reservationNights.toLocaleString("en-CA")}{" "}
              reservation nights (may overlap)
            </small>
            {!item.siteNights ? (
              <small>No currently active sites in this category</small>
            ) : null}
          </article>
        ))}
      </div>
      <div className="camp-occupancy__table-scroll">
        <table className="camp-occupancy__table">
          <caption>
            Exact monthly site nights for the selected accommodation types (
            {range} months, current month to date)
          </caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Month</th>
              <th scope="col">Site nights</th>
              <th scope="col">Booked</th>
              <th scope="col">Seasonal</th>
              <th scope="col">Reservations</th>
              <th scope="col">Booked %</th>
            </tr>
          </thead>
          <tbody>
            {visible.flatMap((item) =>
              item.months
                .filter((row) => months.includes(row.month))
                .map((row) => (
                  <tr key={`${item.kind}-${row.month}`}>
                    <th scope="row">{names[item.kind]}</th>
                    <td>{row.month.slice(0, 7)}</td>
                    <td>{row.siteNights}</td>
                    <td>{row.bookedNights}</td>
                    <td>{row.seasonalNights}</td>
                    <td>{row.reservationNights}</td>
                    <td>{row.bookedPercent}%</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
