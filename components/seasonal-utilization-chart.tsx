"use client";

import { useState } from "react";

import type { SeasonalTrendsSummary } from "@/lib/command-centre/seasonal-trends-core.mjs";

export function SeasonalUtilizationChart({
  summary,
}: {
  summary: SeasonalTrendsSummary;
}) {
  const [months, setMonths] = useState<3 | 6>(6);
  const shown = summary.months.slice(-months);
  return (
    <section
      className="content-panel ops-detail-card camp-seasonal"
      aria-labelledby="seasonal-chart-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Rolling campground utilization</p>
          <h2 id="seasonal-chart-heading">Monthly site-night coverage</h2>
        </div>
        <div
          className="camp-occupancy__range"
          role="group"
          aria-label="Trend time span"
        >
          <button
            type="button"
            aria-pressed={months === 3}
            onClick={() => setMonths(3)}
          >
            3 months
          </button>
          <button
            type="button"
            aria-pressed={months === 6}
            onClick={() => setMonths(6)}
          >
            6 months
          </button>
        </div>
      </div>
      <p className="camp-occupancy__explanation">
        The green bar is booked site-night coverage; the amber bar is the
        seasonal-assignment portion. Seasonal and ordinary reservations may
        cover the same site, so they are not added together. The current month
        ends at today, and earlier months use today&apos;s active site inventory
        as the denominator.
      </p>
      <div className="camp-occupancy__legend" aria-hidden="true">
        <span>
          <i className="camp-occupancy__dot camp-occupancy__dot--booked" />{" "}
          Booked coverage
        </span>
        <span>
          <i className="camp-occupancy__dot camp-occupancy__dot--paused" />{" "}
          Seasonal coverage
        </span>
      </div>
      <div
        className="camp-seasonal__chart"
        role="img"
        aria-label="Monthly booked and seasonal utilization percentages; complete values follow in the table"
      >
        {shown.map((row) => (
          <div className="camp-seasonal__month" key={row.month}>
            <strong>{row.bookedPercent}%</strong>
            <div
              className="camp-seasonal__bars"
              title={`${row.month}: ${row.bookedNights} booked and ${row.seasonalNights} seasonal nights of ${row.siteNights} site nights`}
            >
              <span
                className="camp-seasonal__bar camp-seasonal__bar--booked"
                style={{ height: `${row.bookedPercent}%` }}
              />
              <span
                className="camp-seasonal__bar camp-seasonal__bar--seasonal"
                style={{ height: `${row.seasonalPercent}%` }}
              />
            </div>
            <small>{row.month.slice(0, 7)}</small>
          </div>
        ))}
      </div>
      <div className="camp-occupancy__table-scroll">
        <table className="camp-occupancy__table">
          <caption>
            Exact site-night counts, six-month historical view (current month to
            date)
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Total site nights</th>
              <th scope="col">Booked</th>
              <th scope="col">Seasonal</th>
              <th scope="col">Reservation</th>
              <th scope="col">Booked %</th>
              <th scope="col">Seasonal %</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.month}>
                <th scope="row">{row.month.slice(0, 7)}</th>
                <td>{row.siteNights}</td>
                <td>{row.bookedNights}</td>
                <td>{row.seasonalNights}</td>
                <td>{row.reservationNights}</td>
                <td>{row.bookedPercent}%</td>
                <td>{row.seasonalPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
