"use client";

import { useState } from "react";

import { CHECKPOINTS } from "@/lib/integration/ql258-checkpoints.mjs";
import {
  STATUS,
  defaults,
  makeReport,
} from "@/lib/integration/ql258-contract.mjs";

export function Worksheet() {
  const [progress, setProgress] = useState(defaults);
  const [message, setMessage] = useState("");
  const packet = JSON.stringify(makeReport(progress), null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(packet);
      setMessage("Sanitized report copied; progress is not verified evidence.");
    } catch {
      setMessage("Clipboard unavailable; manually select and copy the JSON.");
    }
  }

  return (
    <section className="content-panel">
      <h2>Seven owner action checkpoints</h2>
      <p>
        Choose only fixed, unverified progress states. This local worksheet
        resets on refresh.
      </p>
      {CHECKPOINTS.map(([id, title]) => (
        <label key={id}>
          <strong>{title}</strong>
          <select
            aria-label={title}
            value={progress[id]}
            onChange={(event) => {
              if (
                !STATUS.includes(event.target.value as (typeof STATUS)[number])
              )
                return;
              setProgress((prior) => ({
                ...prior,
                [id]: event.target.value as (typeof STATUS)[number],
              }));
            }}
          >
            {STATUS.map((value) => (
              <option value={value} key={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>
        No identities, keys, customer records, credentials or authorization
        details are entered.
      </p>
      <button type="button" className="primary-button" onClick={copy}>
        Copy sanitized iCamp handoff
      </button>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setProgress(defaults())}
      >
        Clear progress
      </button>
      {message ? <p role="status">{message}</p> : null}
      <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap" }}>{packet}</pre>
    </section>
  );
}
