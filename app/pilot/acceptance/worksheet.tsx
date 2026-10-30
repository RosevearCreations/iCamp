"use client";

import { useState } from "react";

import {
  PILOT_AREAS,
  PILOT_STATES,
  blankPilot,
  summarizePilot,
} from "@/lib/pilot/build155-acceptance.mjs";

export function AcceptanceWorksheet() {
  const [results, setResults] = useState(blankPilot);
  const [message, setMessage] = useState("");
  const report = summarizePilot(results);
  const serialized = JSON.stringify(report, null, 2);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(serialized);
      setMessage("Local unverified pilot report copied.");
    } catch {
      setMessage("Clipboard unavailable. Select the report below to copy it.");
    }
  }

  return (
    <section className="content-panel">
      <h2>Operational checks</h2>
      <p>
        All checks start as not tested. A reported pass is not an independently
        verified acceptance. Selections stay in this browser tab and reset on
        refresh.
      </p>
      {PILOT_AREAS.map(([id, title]) => (
        <label key={id}>
          <strong>{title}</strong>
          <select
            aria-label={title}
            value={results[id]}
            onChange={(event) => {
              const value = event.target.value;
              if (
                !PILOT_STATES.includes(value as (typeof PILOT_STATES)[number])
              )
                return;
              setResults((previous) => ({
                ...previous,
                [id]: value as (typeof PILOT_STATES)[number],
              }));
            }}
          >
            {PILOT_STATES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>
        {report.counts.NOT_TESTED} untested · {report.counts.BLOCKED} blocked ·{" "}
        {report.counts.FAILED} failed · {report.counts.PASSED_OWNER_REPORTED}{" "}
        reported passed
      </p>
      <button className="primary-button" type="button" onClick={copyReport}>
        Copy sanitized pilot report
      </button>{" "}
      <button
        className="secondary-button"
        type="button"
        onClick={() => {
          setResults(blankPilot());
          setMessage("Checklist cleared.");
        }}
      >
        Reset checks
      </button>
      {message ? <p role="status">{message}</p> : null}
      <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap" }}>
        {serialized}
      </pre>
    </section>
  );
}
