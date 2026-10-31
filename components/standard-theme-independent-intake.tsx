"use client";

import { useState } from "react";

import {
  prepareStandardThemeOwnerIntake,
  readStandardThemeDecisionLedger,
  standardThemeDecisionReadbackSummary,
  STANDARD_OWNER_SUBMISSION_ENABLED,
  type StandardThemeImportedDecision,
  type StandardThemeOwnerIntakeInput,
} from "@/lib/command-centre/standard-theme-owner-intake-core.mjs";

type Campground = { campgroundId: string; campgroundName: string };

export function StandardThemeIndependentIntake({
  review,
  preparerId,
  sourceSha,
  campgrounds,
}: {
  review: StandardThemeOwnerIntakeInput["review"];
  preparerId: string;
  sourceSha: string;
  campgrounds: Campground[];
}) {
  const [campgroundId, setCampgroundId] = useState(
    campgrounds[0]?.campgroundId ?? "",
  );
  const [reviewerId, setReviewerId] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [packetJson, setPacketJson] = useState("");
  const [packetSnapshot, setPacketSnapshot] = useState("");
  const [readbackJson, setReadbackJson] = useState("");
  const [ledger, setLedger] = useState<StandardThemeImportedDecision[]>([]);
  const [status, setStatus] = useState("");

  const intake = prepareStandardThemeOwnerIntake({
    review,
    campgroundId,
    preparerId,
    intendedReviewerId: reviewerId,
    sourceSha,
    sourceReference,
  });
  const ledgerSummary = standardThemeDecisionReadbackSummary(ledger);
  const currentSnapshot = JSON.stringify({
    review,
    campgroundId,
    preparerId,
    reviewerId,
    sourceSha,
    sourceReference,
  });
  const packetStale = Boolean(packetJson && packetSnapshot !== currentSnapshot);

  const clearReadback = () => {
    setPacketJson("");
    setPacketSnapshot("");
    setLedger([]);
    setReadbackJson("");
    setStatus(
      "Scope or source changed. Prepare a new packet and recheck evidence.",
    );
  };

  return (
    <section
      className="camp-theme-review__independent-intake"
      aria-labelledby="independent-intake-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">
            Build 172 · Intake contract · Billing / Omnichannel HELD
          </p>
          <h3 id="independent-intake-heading">
            Independent owner review intake &amp; evidence readback
          </h3>
        </div>
        <span className="ops-pill">Submission disabled · decision pending</span>
      </div>
      <p className="ops-inline-note">
        This worksheet prepares a versioned evidence packet for a different
        owner. The preparer is the signed-in staff account. The intended
        reviewer UUID is only a proposed recipient: it is not an authenticated
        reviewer login or proof of owner authority. Nothing here submits a
        request, records an independent decision, or changes a campground
        record.
      </p>
      <details>
        <summary>ⓘ What counts as actual independent owner acceptance?</summary>
        <p>
          A different authorized owner must sign in independently, inspect
          current screen/device evidence, resolve correction/retest gaps and
          submit to a server-enforced, immutable, campground-scoped decision
          ledger. That workflow is still HELD. This local review cannot replace
          it, even if an imported JSON file claims approval.
        </p>
      </details>
      <div className="camp-theme-review__intake-fields">
        <label htmlFor="intake-campground">
          Authorized campground
          <select
            id="intake-campground"
            value={campgroundId}
            onChange={(event) => {
              setCampgroundId(event.target.value);
              clearReadback();
            }}
          >
            {campgrounds.map((item) => (
              <option key={item.campgroundId} value={item.campgroundId}>
                {item.campgroundName}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="intake-reviewer">
          Intended independent reviewer UUID
          <input
            id="intake-reviewer"
            value={reviewerId}
            maxLength={60}
            autoComplete="off"
            onChange={(event) => {
              setReviewerId(event.target.value);
              clearReadback();
            }}
            placeholder="Different authorized owner's UUID"
          />
        </label>
        <label htmlFor="intake-evidence-reference">
          Source ticket or evidence reference (no guest details)
          <input
            id="intake-evidence-reference"
            value={sourceReference}
            maxLength={180}
            onChange={(event) => {
              setSourceReference(event.target.value);
              setPacketJson("");
            }}
            placeholder="Example: THEME-172-review-worklist"
          />
        </label>
      </div>
      <p className="ops-inline-note">
        Source release SHA: <code>{sourceSha || "unavailable"}</code> ·
        Preparer: <code>{preparerId}</code>. Each exported observation retains
        its source version, manual result, correction and follow-up. After a
        correction or new release, recheck the real devices before preparing a
        replacement packet.
      </p>
      <div className="camp-theme-review__readiness">
        <h4>Intake gate — {intake.ready ? "draft ready" : "blocked"}</h4>
        <p role="status">
          {intake.ready
            ? "Local observations and independent recipient preflight complete. No owner decision has occurred."
            : `${intake.blockers.length} requirement(s) remain before a transferable draft can be prepared.`}
        </p>
        {intake.blockers.length > 0 && (
          <details>
            <summary>Inspect intake blockers</summary>
            <ul>
              {intake.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={!intake.ready}
          onClick={async () => {
            const fresh = prepareStandardThemeOwnerIntake(
              {
                review,
                campgroundId,
                preparerId,
                intendedReviewerId: reviewerId,
                sourceSha,
                sourceReference,
              },
              new Date(),
            );
            if (!fresh.ready) return;
            setPacketJson(fresh.json);
            setPacketSnapshot(currentSnapshot);
            try {
              await navigator.clipboard.writeText(fresh.json);
              setStatus(
                "Versioned intake draft copied. No request or decision was submitted.",
              );
            } catch {
              setStatus(
                "Clipboard unavailable; the draft is available in the read-only field below.",
              );
            }
          }}
        >
          Prepare &amp; copy versioned intake draft
        </button>
        <label htmlFor="independent-intake-packet">
          Prepared packet (browser-local; unsigned)
        </label>
        {packetStale && (
          <p role="alert">
            Walkthrough or evidence scope changed since the packet was prepared.
            The old packet is hidden; recheck and prepare a new draft.
          </p>
        )}
        <textarea
          id="independent-intake-packet"
          rows={5}
          readOnly
          value={packetStale ? "" : packetJson}
          placeholder="Complete the manual review preflight to prepare a source-versioned packet."
        />
      </div>
      <div className="camp-theme-review__readiness">
        <h4>Decision ledger readback — historical claims only</h4>
        <p className="ops-inline-note">
          Paste a private JSON history export only if you are allowed to review
          it. This is local, scoped, and limited to 20 chronological entries.
          Imported pending, rejected, recheck or approved statuses are
          <strong> unverified claims</strong>, never authenticated owner
          decisions. A source SHA change demands independent recheck.
        </p>
        <label htmlFor="independent-ledger-readback">
          Historic readback JSON
        </label>
        <textarea
          id="independent-ledger-readback"
          rows={4}
          maxLength={16_000}
          value={readbackJson}
          onChange={(event) => {
            setReadbackJson(event.target.value);
            setLedger([]);
          }}
          placeholder='{"version":1,"entries":[]}'
        />
        <div className="camp-theme-review__actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              try {
                const entries = readStandardThemeDecisionLedger(readbackJson, {
                  campgroundId,
                  preparerId,
                  sourceSha,
                });
                setLedger(entries);
                setStatus(
                  `${entries.length} historic claim(s) inspected locally. Authenticity and owner authority remain unverified.`,
                );
              } catch (error) {
                setLedger([]);
                setStatus(
                  error instanceof Error
                    ? error.message
                    : "Historic readback rejected.",
                );
              }
            }}
          >
            Inspect read-only decision history
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setReadbackJson("");
              setLedger([]);
              setStatus("Imported history removed from this browser session.");
            }}
          >
            Clear imported history
          </button>
        </div>
        <p role="status">
          {ledgerSummary.total} historic entries ·{" "}
          {ledgerSummary.claimedApproved} claimed approved (unverified) ·{" "}
          {ledgerSummary.recheck} need source recheck · 0 authoritative
          decisions recorded
        </p>
        {ledger.length > 0 && (
          <div className="camp-theme-review__ledger-list">
            <ol>
              {ledger.map((item) => (
                <li key={item.id}>
                  <strong>
                    {item.decision.replaceAll("_", " ")} · unverified import
                  </strong>
                  <span>
                    {item.occurredAt} · {item.evidenceReference}
                  </span>
                  {item.needsSourceRecheck && (
                    <span>Source version changed — fresh retest required</span>
                  )}
                  {item.note && <small>{item.note}</small>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {status && <p role="status">{status}</p>}
      <p className="ops-inline-note">
        Server decision intake:{" "}
        {STANDARD_OWNER_SUBMISSION_ENABLED ? "enabled" : "DISABLED"}. An
        authenticated, tenant-RLS-protected append-only evidence service,
        verified reviewer identity, independent decision endpoint and recheck
        policy are prerequisites to recording acceptance. Billing and
        Omnichannel remain HELD / DISCONNECTED.
      </p>
    </section>
  );
}
