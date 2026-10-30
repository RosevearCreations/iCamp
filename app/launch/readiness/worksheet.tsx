"use client";

import { useState } from "react";
import {
  LAUNCH_CHECKS,
  LAUNCH_STATES,
  blankLaunch,
  launchReport,
} from "@/lib/launch/build156-gate.mjs";

export function LaunchWorksheet() {
  const [checks, setChecks] = useState(blankLaunch);
  const [message, setMessage] = useState("");
  const packet = JSON.stringify(launchReport(checks), null, 2);

  async function copyPacket() {
    try {
      await navigator.clipboard.writeText(packet);
      setMessage("Sanitized, unverified readiness report copied.");
    } catch {
      setMessage("Clipboard unavailable. Select the report below to copy.");
    }
  }

  return (
    <section className="content-panel">
      <h2>Seven release checks</h2>
      <p>
        Selections are temporary, remain in this browser tab and cannot
        independently approve a release. Do not enter credentials or customer
        information.
      </p>
      {LAUNCH_CHECKS.map(([id, label]) => (
        <label key={id}>
          <strong>{label}</strong>
          <select
            aria-label={label}
            value={checks[id]}
            onChange={(event) => {
              const value = event.target.value;
              if (
                !LAUNCH_STATES.includes(value as (typeof LAUNCH_STATES)[number])
              )
                return;
              setChecks((prior) => ({
                ...prior,
                [id]: value as (typeof LAUNCH_STATES)[number],
              }));
            }}
          >
            {LAUNCH_STATES.map((state) => (
              <option key={state} value={state}>
                {state.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>Launch gate: HOLD · Billing: OFF · External services: OFF</p>
      <button className="primary-button" type="button" onClick={copyPacket}>
        Copy readiness report
      </button>{" "}
      <button
        className="secondary-button"
        type="button"
        onClick={() => {
          setChecks(blankLaunch());
          setMessage("Readiness checklist reset.");
        }}
      >
        Reset checks
      </button>
      {message ? <p role="status">{message}</p> : null}
      <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap" }}>{packet}</pre>
    </section>
  );
}
