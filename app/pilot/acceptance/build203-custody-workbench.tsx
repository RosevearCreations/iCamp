"use client";

import { useEffect, useState } from "react";
import { build203Runbook } from "@/lib/pilot/build203-custody.mjs";

type Campground = {
  campgroundId: string;
  campgroundName: string;
  canReview: boolean;
  canAuthorize: boolean;
};
type Evidence = {
  id: string;
  evidenceRef: string;
  claimedSha256: string;
  sourceClass: string;
};
type Review = {
  id: string;
  evidenceId: string;
  issuerReceiptRef: string;
  claimedDigestComparison: string;
  disposition: string;
};
type Owner = {
  id: string;
  decision: string;
  expiresAt: string | null;
  disposition: string;
};
type Report = {
  evidence: Evidence[];
  reviews: Review[];
  ownerIntents: Owner[];
  ownerIntentState: string;
  connection_state: string;
  issuer_independently_verified: boolean;
};

async function readPrivateResponse(response: Response) {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error(
      response.status === 409
        ? "Duplicate, mismatched tenant, or an independent reviewer is required. Nothing changed."
        : "Private custody/owner evidence is unavailable; nothing was authorized.",
    );
  return response.json();
}

export function Build203CustodyWorkbench() {
  const [campgrounds, setCampgrounds] = useState<Campground[]>([]);
  const [campgroundId, setCampgroundId] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [issuerReceiptRef, setIssuerReceiptRef] = useState("");
  const [issuerClaimedSha256, setIssuerClaimedSha256] = useState("");
  const [custodyReviewId, setCustodyReviewId] = useState("");
  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Sign in as an assigned owner or I.T. reviewer to see private custody claims.",
  );

  useEffect(() => {
    let active = true;
    fetch("/api/it/pilot-custody", {
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
    })
      .then(readPrivateResponse)
      .then((data: { campgrounds: Campground[] }) => {
        if (!active) return;
        setCampgrounds(data.campgrounds);
        if (data.campgrounds.length)
          setCampgroundId(data.campgrounds[0].campgroundId);
        setMessage(
          data.campgrounds.length
            ? "Select a campground, then refresh original and independent-review claims."
            : "No owner/I.T. custody review assignment is available.",
        );
      })
      .catch(() => {
        if (active)
          setMessage(
            "Authorized sign-in and the private database are required.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh(selected: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/it/pilot-custody?campgroundId=${encodeURIComponent(selected)}`,
        { credentials: "same-origin", cache: "no-store", redirect: "manual" },
      );
      const value = (await readPrivateResponse(response)) as Report;
      if (
        value.connection_state !== "DISCONNECTED / HOLD" ||
        value.issuer_independently_verified
      )
        throw new Error("Unexpected custody authority assertion");
      setReport(value);
      setEvidenceId((old) =>
        value.evidence.some((item) => item.id === old)
          ? old
          : (value.evidence[0]?.id ?? ""),
      );
      setCustodyReviewId((old) =>
        value.reviews.some((item) => item.id === old)
          ? old
          : (value.reviews[0]?.id ?? ""),
      );
      setMessage(
        `${value.evidence.length} original claims; ${value.reviews.length} second-source reviews. No independent authority is verified.`,
      );
    } catch {
      setReport(null);
      setMessage(
        "Custody readback unavailable. All TEST and production operations remain blocked.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/it/pilot-custody", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await readPrivateResponse(response);
      await refresh(campgroundId);
      setIssuerReceiptRef("");
      setIssuerClaimedSha256("");
      setScopeAcknowledged(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Nothing was recorded.",
      );
    } finally {
      setBusy(false);
    }
  }
  const assigned = campgrounds.find(
    (camp) => camp.campgroundId === campgroundId,
  );
  const runbook = build203Runbook(report ?? undefined);
  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="pilot203-heading"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">
            Build 203 · original-issuer custody &amp; isolated TEST decision
          </p>
          <h2 id="pilot203-heading">
            Independent custody review &amp; owner TEST authorization desk
          </h2>
        </div>
        <span className="ops-pill ops-pill--hold">DISCONNECTED / HOLD</span>
      </div>
      <p>
        This desk compares two <strong>claimed</strong> source digests and
        records an authenticated owner&apos;s limited TEST intent. Matching
        self-entered digests are not independent issuer proof. Do not enter
        personal details, credentials, private keys, signed tokens or raw
        documents.
      </p>
      <label htmlFor="pilot203-camp">Authorized campground</label>
      <select
        id="pilot203-camp"
        value={campgroundId}
        disabled={!campgrounds.length || busy}
        onChange={(event) => {
          setCampgroundId(event.target.value);
          setReport(null);
          setEvidenceId("");
          setCustodyReviewId("");
        }}
      >
        {!campgrounds.length ? (
          <option value="">Sign in to select</option>
        ) : null}
        {campgrounds.map((camp) => (
          <option key={camp.campgroundId} value={camp.campgroundId}>
            {camp.campgroundName}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="secondary-button"
        onClick={() => refresh(campgroundId)}
        disabled={!campgroundId || busy}
      >
        Refresh custody &amp; owner decisions
      </button>
      <div className="ops-split-grid">
        <div>
          <h3>Second-source custody comparison</h3>
          <p>
            A different owner/I.T. reviewer must record the second-source
            observation.
          </p>
          <label htmlFor="pilot203-source">Build 202 original evidence</label>
          <select
            id="pilot203-source"
            value={evidenceId}
            disabled={busy || !report?.evidence.length}
            onChange={(event) => setEvidenceId(event.target.value)}
          >
            {!report?.evidence.length ? (
              <option value="">No original claims loaded</option>
            ) : null}
            {report?.evidence.map((item) => (
              <option key={item.id} value={item.id}>
                {item.evidenceRef} · {item.sourceClass}
              </option>
            ))}
          </select>
          <label htmlFor="pilot203-issuer-ref">
            Independent issuer receipt reference (claim)
          </label>
          <input
            id="pilot203-issuer-ref"
            value={issuerReceiptRef}
            maxLength={90}
            placeholder="receipt-issuer-00001"
            onChange={(event) => setIssuerReceiptRef(event.target.value)}
          />
          <label htmlFor="pilot203-issuer-digest">Claimed issuer SHA-256</label>
          <input
            id="pilot203-issuer-digest"
            value={issuerClaimedSha256}
            maxLength={64}
            placeholder="64 lowercase hexadecimal characters"
            onChange={(event) => setIssuerClaimedSha256(event.target.value)}
          />
          <button
            type="button"
            className="primary-button"
            disabled={
              !assigned?.canReview ||
              !evidenceId ||
              !issuerReceiptRef ||
              issuerClaimedSha256.length !== 64 ||
              busy
            }
            onClick={() =>
              submit({
                action: "RECONCILE_SOURCE_CLAIMS",
                campgroundId,
                evidenceId,
                issuerReceiptRef,
                issuerClaimedSha256,
              })
            }
          >
            Record unverified custody comparison
          </button>
          <ul>
            {report?.reviews.map((review) => (
              <li key={review.id}>
                <strong>{review.issuerReceiptRef}</strong> ·{" "}
                {review.claimedDigestComparison.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Owner isolated TEST intent</h3>
          <p>
            Only the campground owner may record this decision. It is not
            independent master-owner approval, a verified signer, or permission
            to call Comms Hub.
          </p>
          <label htmlFor="pilot203-review">Reviewed source pair</label>
          <select
            id="pilot203-review"
            value={custodyReviewId}
            disabled={busy || !report?.reviews.length}
            onChange={(event) => setCustodyReviewId(event.target.value)}
          >
            {!report?.reviews.length ? (
              <option value="">No reviewed pair available</option>
            ) : null}
            {report?.reviews.map((review) => (
              <option key={review.id} value={review.id}>
                {review.issuerReceiptRef}
              </option>
            ))}
          </select>
          <label className="ops-checkbox-label">
            <input
              type="checkbox"
              checked={scopeAcknowledged}
              disabled={busy || !assigned?.canAuthorize}
              onChange={(event) => setScopeAcknowledged(event.target.checked)}
            />
            I request an isolated nonproduction TEST window (one hour), with no
            live communications or production access.
          </label>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              disabled={
                !assigned?.canAuthorize ||
                !custodyReviewId ||
                !scopeAcknowledged ||
                busy
              }
              onClick={() =>
                submit({
                  action: "OWNER_TEST_INTENT",
                  campgroundId,
                  custodyReviewId,
                  decision: "REQUEST_ISOLATED_TEST",
                  scopeAcknowledged: true,
                  requestId: crypto.randomUUID(),
                  expiresAt: new Date(Date.now() + 3600000).toISOString(),
                })
              }
            >
              Record owner TEST intent (still HOLD)
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!assigned?.canAuthorize || !custodyReviewId || busy}
              onClick={() =>
                submit({
                  action: "OWNER_TEST_INTENT",
                  campgroundId,
                  custodyReviewId,
                  decision: "WITHDRAW_ISOLATED_TEST",
                  scopeAcknowledged: false,
                  requestId: crypto.randomUUID(),
                  expiresAt: null,
                })
              }
            >
              Withdraw owner TEST intent
            </button>
          </div>
          <p>
            <strong>Owner intent:</strong>{" "}
            {report?.ownerIntentState.replaceAll("_", " ") ?? "NOT RECORDED"}
          </p>
          <p>
            <strong>Connection:</strong> DISCONNECTED / HOLD
          </p>
          <ul>
            {report?.ownerIntents.map((event) => (
              <li key={event.id}>
                {event.decision.replaceAll("_", " ")} ·{" "}
                {event.disposition.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h3>Nonproduction handshake runbook · manual NO-GO gate</h3>
      <ol>
        {runbook.steps.map((step) => (
          <li key={step.order}>{step.instruction}</li>
        ))}
      </ol>
      <p>
        No live KMS enrollment, nonce claim, Hub request, SMS, calls or gate
        actions are executed by this workbench.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
