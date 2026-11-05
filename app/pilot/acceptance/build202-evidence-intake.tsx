"use client";

import { useEffect, useState } from "react";
import {
  BUILD202_DEVICES,
  BUILD202_EVIDENCE_CLASSES,
} from "@/lib/pilot/build202-evidence.mjs";

type Assigned = {
  campgroundId: string;
  campgroundName: string;
  canIntake: boolean;
};
type EvidenceRow = {
  id: string;
  sourceClass: string;
  evidenceRef: string;
  claimedSha256: string;
  deviceProfile: string | null;
  submittedAt: string;
  disposition: string;
};
type Readback = {
  rows: EvidenceRow[];
  peer_enrollment: string;
  signed_get_witness: string;
  connection_state: string;
};

async function jsonResponse(response: Response) {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error(
      response.status === 409
        ? "Duplicate source reference; no record added."
        : "Private owner/I.T. evidence access unavailable.",
    );
  return response.json();
}

export function Build202EvidenceIntake() {
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [campgroundId, setCampgroundId] = useState("");
  const [sourceClass, setSourceClass] = useState("real_device");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [claimedSha256, setClaimedSha256] = useState("");
  const [deviceProfile, setDeviceProfile] = useState("PHONE_TOUCH");
  const [report, setReport] = useState<Readback | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Sign in as an assigned owner or I.T. reviewer to open the private intake.",
  );

  useEffect(() => {
    let active = true;
    fetch("/api/it/pilot-evidence", {
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
    })
      .then(jsonResponse)
      .then((data: { campgrounds: Assigned[] }) => {
        if (!active) return;
        setAssigned(data.campgrounds);
        if (data.campgrounds.length)
          setCampgroundId(data.campgrounds[0].campgroundId);
        setMessage(
          data.campgrounds.length
            ? "Choose the campground and submit source-reference claims for independent review."
            : "No authorized campground review assignment is available.",
        );
      })
      .catch(() => {
        if (active)
          setMessage(
            "Private evidence intake requires an authorized owner or I.T. sign-in and the connected database.",
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
        `/api/it/pilot-evidence?campgroundId=${encodeURIComponent(selected)}`,
        { credentials: "same-origin", cache: "no-store", redirect: "manual" },
      );
      const value = (await jsonResponse(response)) as Readback;
      if (value.connection_state !== "DISCONNECTED / HOLD")
        throw new Error("Unexpected trust state");
      setReport(value);
      setMessage(
        `${value.rows.length} submitted references returned. All remain unverified and cannot authorize a connection.`,
      );
    } catch {
      setReport(null);
      setMessage("Private intake readback unavailable. No claim was verified.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!campgroundId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/it/pilot-evidence", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId,
          sourceClass,
          evidenceRef,
          claimedSha256,
          deviceProfile: sourceClass === "real_device" ? deviceProfile : null,
        }),
      });
      await jsonResponse(response);
      setEvidenceRef("");
      setClaimedSha256("");
      await refresh(campgroundId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Nothing was stored.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canIntake =
    assigned.find((camp) => camp.campgroundId === campgroundId)?.canIntake ===
    true;
  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="build202-evidence-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">
            Build 202 · private append-only reference intake
          </p>
          <h2 id="build202-evidence-title">
            Independent pilot evidence intake &amp; peer enrollment review
          </h2>
        </div>
        <span className="ops-pill ops-pill--hold">
          Submission ≠ verification
        </span>
      </div>
      <p>
        Enter only the original source&apos;s non-sensitive receipt reference
        and its claimed 64-character SHA-256 digest. Never paste signed tokens,
        private keys, guest identities, testimony, device serial numbers or
        screenshots here. Server-stored entries are append-only and cannot mark
        themselves independently verified.
      </p>
      <div className="ops-split-grid">
        <div>
          <label htmlFor="pilot202-campground">Authorized campground</label>
          <select
            id="pilot202-campground"
            value={campgroundId}
            disabled={!assigned.length || busy}
            onChange={(event) => {
              setCampgroundId(event.target.value);
              setReport(null);
            }}
          >
            {!assigned.length ? (
              <option value="">Sign in to select</option>
            ) : null}
            {assigned.map((camp) => (
              <option value={camp.campgroundId} key={camp.campgroundId}>
                {camp.campgroundName}
              </option>
            ))}
          </select>
          <label htmlFor="pilot202-class">Evidence category</label>
          <select
            id="pilot202-class"
            value={sourceClass}
            onChange={(event) => setSourceClass(event.target.value)}
          >
            {BUILD202_EVIDENCE_CLASSES.map((item) => (
              <option value={item} key={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {sourceClass === "real_device" ? (
            <>
              <label htmlFor="pilot202-device">
                Device/accessibility profile
              </label>
              <select
                id="pilot202-device"
                value={deviceProfile}
                onChange={(event) => setDeviceProfile(event.target.value)}
              >
                {BUILD202_DEVICES.map((item) => (
                  <option value={item} key={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label htmlFor="pilot202-reference">
            Original evidence reference (no personal details)
          </label>
          <input
            id="pilot202-reference"
            value={evidenceRef}
            maxLength={90}
            placeholder="receipt-2026-000123"
            onChange={(event) => setEvidenceRef(event.target.value)}
          />
          <label htmlFor="pilot202-digest">
            Claimed source SHA-256 (unverified)
          </label>
          <input
            id="pilot202-digest"
            value={claimedSha256}
            maxLength={64}
            placeholder="64 lowercase hexadecimal characters"
            onChange={(event) => setClaimedSha256(event.target.value)}
          />
          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              disabled={
                !canIntake ||
                busy ||
                !evidenceRef ||
                claimedSha256.length !== 64
              }
              onClick={submit}
            >
              Submit unverified evidence claim
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!campgroundId || busy}
              onClick={() => refresh(campgroundId)}
            >
              Refresh private review
            </button>
          </div>
        </div>
        <div>
          <h3>Actual custody and scoped TEST gate</h3>
          <p>
            Independent source signer: <strong>NOT VERIFIED</strong>
          </p>
          <p>
            Trusted Comms Hub issuer: <strong>NOT ENROLLED</strong>
          </p>
          <p>
            Owner-approved isolated TEST: <strong>NOT WITNESSED</strong>
          </p>
          <p>
            Signed, non-replayed GET: <strong>NOT WITNESSED</strong>
          </p>
          <p>
            Connection: <strong>DISCONNECTED / HOLD</strong>
          </p>
          <p>
            Actual private handshake requires an independent verified
            key/issuer, source KMS, durable nonce claim and two owner approvals.
            This page never issues or sends a challenge.
          </p>
        </div>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {report ? (
        <div className="ops-status-row">
          <strong>
            {report.rows.length} owner/I.T.-submitted reference(s) ·{" "}
            {report.connection_state}
          </strong>
          {report.rows.length ? (
            <ul>
              {report.rows.map((row) => (
                <li key={row.id}>
                  <strong>{row.evidenceRef}</strong> ·{" "}
                  {row.sourceClass.replaceAll("_", " ")} · {row.disposition} ·
                  claimed SHA-256:{" "}
                  <code>{row.claimedSha256.slice(0, 12)}…</code>
                </li>
              ))}
            </ul>
          ) : (
            <p>None. Independent source receipts have not been submitted.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
