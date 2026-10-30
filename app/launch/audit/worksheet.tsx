"use client";

import { useState } from "react";
import {
  AUDIT_SECTIONS,
  AUDIT_STATES,
  blankAudit,
  makeAuditReport,
} from "@/lib/launch/build158-audit.mjs";

export function OwnerAudit() {
  const [checks, setChecks] = useState(blankAudit);
  const [message, setMessage] = useState("");
  const report = makeAuditReport(checks);
  const packet = JSON.stringify(report, null, 2);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(packet);
      setMessage("Sanitized, unverified owner-status report copied.");
    } catch {
      setMessage("Clipboard unavailable. Select the report below to copy.");
    }
  }

  return (
    <section className="content-panel">
      <h2>Eleven evidence checkpoints</h2>
      <p>
        Selections are local to this tab and reset on refresh. A reported
        completion never becomes an independent receipt or approval.
      </p>
      {AUDIT_SECTIONS.map(([id, label]) => (
        <label key={id}>
          <strong>{label}</strong>
          <select
            aria-label={label}
            value={checks[id]}
            onChange={(event) => {
              const value = event.target.value;
              if (
                !AUDIT_STATES.includes(value as (typeof AUDIT_STATES)[number])
              )
                return;
              setChecks((previous) => ({
                ...previous,
                [id]: value as (typeof AUDIT_STATES)[number],
              }));
            }}
          >
            {AUDIT_STATES.map((state) => (
              <option key={state} value={state}>
                {state.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>
        Owner-reported complete: {report.reported_done} /{" "}
        {report.required_total}. Live billing OFF · Connection DISCONNECTED /
        HOLD.
      </p>
      <button className="primary-button" type="button" onClick={copyReport}>
        Copy sanitized review packet
      </button>{" "}
      <button
        className="secondary-button"
        type="button"
        onClick={() => {
          setChecks(blankAudit());
          setMessage("Review cleared.");
        }}
      >
        Reset review
      </button>
      {message ? <p role="status">{message}</p> : null}
      <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap" }}>{packet}</pre>
    </section>
  );
}
