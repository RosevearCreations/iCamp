"use client";

import { useState } from "react";

import type { OccupancySummary } from "@/lib/command-centre/occupancy-core.mjs";

export function OccupancyCapacityChart({
  summary,
}: {
  summary: OccupancySummary;
}) {
  const [range, setRange] = useState<7 | 14>(7);
  const days = summary.days.slice(0, range);
  return (
    <section className="content-panel ops-detail-card">
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Daily booking coverage</p>
          <h2>Capacity & occupancy trend</h2>
        </div>
        <div
          className="camp-occupancy__range"
          role="group"
          aria-label="Chart date range"
        >
          <button
            type="button"
            aria-pressed={range === 7}
            onClick={() => setRange(7)}
          >
            7 days
          </button>
          <button
            type="button"
            aria-pressed={range === 14}
            onClick={() => setRange(14)}
          >
            14 days
          </button>
        </div>
      </div>
      <p className="camp-occupancy__explanation">
        Each bar compares confirmed/checked-in or seasonally assigned site
        nights with the active accommodation inventory. A site may also be held
        or temporarily unavailable, so this chart is for planning, not a booking
        quote.
      </p>
      <div className="camp-occupancy__legend">
        <span>
          <i className="camp-occupancy__dot camp-occupancy__dot--booked" />
          Booked/occupied
        </span>
        <span>
          <i className="camp-occupancy__dot camp-occupancy__dot--paused" />
          Out of service
        </span>
        <span>
          <i className="camp-occupancy__dot camp-occupancy__dot--free" />
          Other capacity
        </span>
      </div>
      <div
        className="camp-occupancy__chart"
        role="img"
        aria-label={`${range}-day campground capacity chart; values are listed in the accessible table below`}
      >
        {days.map((day) => (
          <div className="camp-occupancy__day" key={day.date}>
            <strong>{day.bookedPercent}%</strong>
            <div
              className="camp-occupancy__column"
              title={`${day.date}: ${day.bookedSites} booked, ${day.pausedSites} offline of ${day.totalSites} sites`}
            >
              <span
                className="camp-occupancy__column-bar camp-occupancy__column-bar--booked"
                style={{ height: `${day.bookedPercent}%` }}
              />
              <span
                className="camp-occupancy__column-bar camp-occupancy__column-bar--paused"
                style={{ height: `${day.pausedPercent}%` }}
              />
            </div>
            <small>{day.date.slice(5)}</small>
          </div>
        ))}
      </div>
      <div className="camp-occupancy__table-scroll">
        <table className="camp-occupancy__table">
          <caption>
            Exact daily site counts from the selected campground
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Sites</th>
              <th scope="col">Operating</th>
              <th scope="col">Booked</th>
              <th scope="col">Holds</th>
              <th scope="col">Pending</th>
              <th scope="col">Offline</th>
              <th scope="col">Booked %</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{day.date}</th>
                <td>{day.totalSites}</td>
                <td>{day.operatingSites}</td>
                <td>{day.bookedSites}</td>
                <td>{day.heldSites}</td>
                <td>{day.pendingSites}</td>
                <td>{day.pausedSites}</td>
                <td>{day.bookedPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
