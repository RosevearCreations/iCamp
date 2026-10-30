"use client";

import { useState } from "react";

import {
  createAgreementReview,
  previewAgreementDecision,
  type AgreementSnapshot,
} from "@/lib/tenant-subscription/agreement-approval.mjs";

const DEMO_SHA = "a".repeat(64); // explicitly synthetic, not a hash of legal documents
const ACTORS = ["author_demo", "reviewer_demo", "approver_demo"] as const;
const ACTIONS = ["submit", "review", "approve"] as const;

export function AgreementReviewPreview() {
  const [version, setVersion] = useState("terms-demo-2026.1");
  const [digest, setDigest] = useState(DEMO_SHA);
  const [snapshot, setSnapshot] = useState<AgreementSnapshot | null>(null);
  const [message, setMessage] = useState(
    "No documents are registered or approved by this worksheet.",
  );

  function begin() {
    try {
      setSnapshot(createAgreementReview({ version, contentSha256: digest }));
      setMessage(
        "Local preview started. No authenticated review receipt was created.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Invalid review fields.",
      );
    }
  }

  function advance(action: (typeof ACTIONS)[number], actor: string) {
    if (!snapshot) return;
    try {
      const next = previewAgreementDecision(snapshot, {
        action,
        actor,
        expectedRevision: snapshot.revision,
      });
      setSnapshot(next);
      setMessage(
        action === "approve"
          ? "Three-role separation preview complete. Real approval remains HELD; this is NOT legally approved."
          : `Preview stage: ${next.state}. No real approval recorded.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Step rejected.");
    }
  }

  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="agreement-preview-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Legal review · Synthetic preview</p>
          <h2 id="agreement-preview-title">
            Versioned subscriber agreement workflow
          </h2>
        </div>
        <span className="ops-pill ops-pill--hold">
          HELD · No binding decisions
        </span>
      </div>
      <p>
        Try the author → independent reviewer → independent approver sequence.
        Everything stays in this browser session and is discarded on reload.
        Enter no real personal information or confidential agreement text.
      </p>
      <div className="agreement-fields">
        <label>
          Demonstration version
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            disabled={snapshot !== null}
          />
        </label>
        <label>
          Demonstration SHA-256 digest
          <input
            value={digest}
            onChange={(event) => setDigest(event.target.value)}
            disabled={snapshot !== null}
            maxLength={64}
            aria-describedby="fake-digest-hint"
          />
        </label>
      </div>
      <p id="fake-digest-hint" className="muted">
        The prefilled digest is deliberately synthetic. It is not proof of
        reviewed subscriber terms.
      </p>
      <div className="agreement-stage-grid">
        {ACTIONS.map((action, index) => {
          const completed = Boolean(
            snapshot?.history.some((item) => item.action === action),
          );
          const canRun = Boolean(
            snapshot && snapshot.revision === index && !completed,
          );
          return (
            <div className="agreement-stage" key={action}>
              <span>
                {`0${index + 1}`} · {action.replaceAll("_", " ")}
              </span>
              <strong>{completed ? "Previewed" : "Waiting"}</strong>
              <small>{ACTORS[index]} · synthetic actor</small>
              <button
                type="button"
                className="secondary-button"
                disabled={!canRun}
                onClick={() => advance(action, ACTORS[index])}
              >
                Preview {action}
              </button>
            </div>
          );
        })}
      </div>
      <div className="hero-actions">
        <button
          type="button"
          className="primary-button"
          disabled={snapshot !== null}
          onClick={begin}
        >
          Start local review preview
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setSnapshot(null);
            setMessage("Preview reset. No real approval recorded.");
          }}
        >
          Reset
        </button>
      </div>
      <p role="status">{message}</p>
      <p className="ops-inline-note">
        Real approval still requires Canadian legal review, authenticated roles,
        an independent evidence witness, immutable published document versions
        and a privileged append-only storage workflow. No legal content,
        signatures or acceptance receipts have been seeded.
      </p>
    </section>
  );
}
