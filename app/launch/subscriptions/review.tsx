"use client";

import { useState } from "react";
import {
  INDEPENDENT_EVIDENCE_ITEMS,
  INDEPENDENT_EVIDENCE_STATES,
  blankIndependentEvidence,
  reconcileIndependentEvidence,
} from "@/lib/tenant-subscription/foundation.mjs";

const captions: Record<string, string> = {
  provider_sandbox: "Provider credentials and isolated billing sandbox",
  signed_webhook: "Signed webhooks and replay protection",
  subscription_lifecycle: "Renewal, failed invoice, refund and dispute tests",
  reviewed_terms: "Approved subscriber agreement and privacy content",
  versioned_consent: "Authenticated versioned consent receipts",
  isolated_tenant: "Independent nonproduction tenant isolation",
  independent_custody: "Independent signer, witness and reviewer",
  signed_source_proof: "Original signed proof B and public pin verification",
  owner_test_authorization: "Explicit signed GET-only TEST authorization",
};

export function IndependentEvidenceReview() {
  const [states, setStates] = useState(blankIndependentEvidence);
  const [copyStatus, setCopyStatus] = useState("");
  const result = reconcileIndependentEvidence(states);
  const percentage = Math.round((100 * result.reviewed) / result.required);

  async function copyReview() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopyStatus(
        "Sanitized local review copied. Independent verification remains required.",
      );
    } catch {
      setCopyStatus("Clipboard unavailable; use your browser’s copy controls.");
    }
  }

  return (
    <section className="content-panel ops-detail-card">
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Evidence centre · Local worksheet</p>
          <h2>Independent omnichannel reconciliation</h2>
        </div>
        <span className="ops-pill ops-pill--hold">DISCONNECTED / HOLD</span>
      </div>
      <p>
        Record nonsecret progress locally. A selected “independently reviewed”
        state is <strong>only an unverified report on this screen</strong>—it
        never unlocks billing, messages or authenticated gateway tests.
      </p>
      <div className="ops-progress-summary">
        <div>
          <strong>
            {result.reviewed}
            <span> / {result.required}</span>
          </strong>
          <small>Reported as independently reviewed (not validated)</small>
        </div>
        <div
          className="ops-progress-track"
          role="progressbar"
          aria-label="Owner-reported reviewed checkpoints"
          aria-valuenow={result.reviewed}
          aria-valuemin={0}
          aria-valuemax={result.required}
        >
          <span style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <div className="ops-evidence-list">
        {INDEPENDENT_EVIDENCE_ITEMS.map((id) => (
          <label className="ops-evidence-row" key={id}>
            <span>{captions[id]}</span>
            <select
              aria-label={captions[id]}
              value={states[id]}
              onChange={(event) => {
                const proposed = event.target.value;
                if (!INDEPENDENT_EVIDENCE_STATES.includes(proposed)) return;
                setStates((previous) => ({
                  ...previous,
                  [id]: proposed as (typeof previous)[string],
                }));
              }}
            >
              {INDEPENDENT_EVIDENCE_STATES.map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="hero-actions">
        <button type="button" className="primary-button" onClick={copyReview}>
          Copy sanitized status summary
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setStates(blankIndependentEvidence());
            setCopyStatus("Review reset.");
          }}
        >
          Reset worksheet
        </button>
      </div>
      {copyStatus ? <p role="status">{copyStatus}</p> : null}
    </section>
  );
}
