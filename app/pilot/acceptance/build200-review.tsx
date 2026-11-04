"use client";

import { useState } from "react";
import Link from "next/link";

import {
  BUILD200_JOURNEYS,
  BUILD200_REVIEW_STATES,
  build200ReviewRows,
  build200ReviewPacket,
} from "@/lib/pilot/build200-pilot.mjs";

type Report = { state: string; sourceRef: string };

export function Build200Review() {
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [message, setMessage] = useState("");
  const [exportPacket, setExportPacket] = useState<object | null>(null);
  const review = build200ReviewRows(reports);
  const setJourney = (id: string, change: Partial<Report>) => {
    setExportPacket(null);
    setReports((previous) => ({
      ...previous,
      [id]: {
        ...(previous[id] ?? { state: "NOT_RUN", sourceRef: "" }),
        ...change,
      },
    }));
  };

  async function copyReport() {
    try {
      const packet = await build200ReviewPacket(reports);
      setExportPacket(packet);
      await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
      setMessage("Unverified, sanitized pilot worksheet copied.");
    } catch {
      setMessage("Select the evidence JSON below to copy it manually.");
    }
  }

  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="build200-review-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Build 200 · owner walkthrough</p>
          <h2 id="build200-review-title">
            Guest &amp; staff journey workboard
          </h2>
        </div>
        <span className="ops-pill ops-pill--hold">GO-LIVE HELD</span>
      </div>
      <p>
        Each link opens the actual application module. We record what we
        observed during our walkthrough, but selections are kept only in this
        browser tab and are{" "}
        <strong>not authenticated independent approval</strong>. Use
        non-sensitive ticket IDs or test evidence references only.
      </p>
      <div className="ops-kpi-grid">
        <article className="ops-kpi">
          <div>
            <span>Journeys to inspect</span>
            <strong>{BUILD200_JOURNEYS.length}</strong>
            <small>Guest, staff and connection paths</small>
          </div>
        </article>
        <article className="ops-kpi">
          <div>
            <span>Owner-reported passes</span>
            <strong>{review.counts.PASS_OWNER_REPORTED}</strong>
            <small>Still require independent witness</small>
          </div>
        </article>
        <article className="ops-kpi">
          <div>
            <span>Unrun / blocked / failed</span>
            <strong>
              {review.counts.NOT_RUN +
                review.counts.BLOCKED +
                review.counts.FAILED}
            </strong>
            <small>No automatic closure</small>
          </div>
        </article>
      </div>
      <div className="ops-split-grid">
        {BUILD200_JOURNEYS.map((journey) => (
          <article className="content-panel ops-detail-card" key={journey.id}>
            <h3>{journey.title}</h3>
            <p>{journey.manual}</p>
            <p>
              <Link
                href={journey.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open actual workflow (new tab)
              </Link>
            </p>
            <label htmlFor={`build200-status-${journey.id}`}>
              Our observation
            </label>
            <select
              id={`build200-status-${journey.id}`}
              value={reports[journey.id]?.state ?? "NOT_RUN"}
              onChange={(event) =>
                setJourney(journey.id, { state: event.target.value })
              }
            >
              {BUILD200_REVIEW_STATES.map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <label htmlFor={`build200-evidence-${journey.id}`}>
              Test receipt or issue ID (optional)
            </label>
            <input
              id={`build200-evidence-${journey.id}`}
              maxLength={120}
              placeholder="e.g. owner-ticket-2026-004"
              value={reports[journey.id]?.sourceRef ?? ""}
              onChange={(event) =>
                setJourney(journey.id, { sourceRef: event.target.value })
              }
            />
            <small>
              Source routes catalogued: {journey.routes.length}; automated test
              files: {journey.tests.length}. These counts do not certify
              acceptance.
            </small>
          </article>
        ))}
      </div>
      <div className="hero-actions">
        <button type="button" className="primary-button" onClick={copyReport}>
          Copy source-labelled pilot JSON
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setReports({});
            setExportPacket(null);
            setMessage("Walkthrough selections cleared.");
          }}
        >
          Reset
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <details>
        <summary>Inspect sanitized evidence packet</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {exportPacket
            ? JSON.stringify(exportPacket, null, 2)
            : "Select Copy to generate the SHA-256-labelled review packet. No record is transmitted."}
        </pre>
      </details>
    </section>
  );
}
