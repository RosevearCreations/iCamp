"use client";

import { useState } from "react";

type Preflight = {
  connection_state: string;
  source_owned_shell_contract: string;
  source_owned_shell_paths: string[];
  source_owned_shell_status: string;
  claimed_signature: string;
  independent_source_signer: string;
  trusted_hub_peer_issuer: string;
  authorized_test_tenant: string;
  signed_replay_protected_get: string;
  deployment_boundary: string;
  legacy_ai_data_platform_gateway: string;
  pending_gates: string[];
  operator_action: string;
};

export function Build201HandshakePreflight() {
  const [report, setReport] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function runPreflight() {
    setBusy(true);
    setMessage("");
    setReport(null);
    try {
      const response = await fetch("/api/it/comms-hub/handshake-preflight", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("Staff access or network unavailable");
      const data = (await response.json()) as Preflight;
      if (data.connection_state !== "DISCONNECTED / HOLD")
        throw new Error("Unexpected connection state");
      setReport(data);
    } catch {
      setMessage(
        "Cannot read private preflight. Sign in with I.T. permissions and retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="build201-preflight-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">
            Build 201 · source trust and TEST boundaries
          </p>
          <h2 id="build201-preflight-title">
            Trusted Comms Hub nonproduction handshake preflight
          </h2>
        </div>
        <span className="ops-pill ops-pill--hold">Not connected</span>
      </div>
      <p>
        This I.T.-only readback checks iCamp&apos;s actual public manifest and
        its separate legacy nonproduction gateway configuration. It cannot view
        Comms Hub&apos;s private issuer registry, witness a signer, approve a
        tenant or send a signed gateway request. Those steps require original
        independent source records and a permitted isolated TEST window.
      </p>
      <button
        type="button"
        className="primary-button"
        disabled={busy}
        onClick={runPreflight}
      >
        {busy
          ? "Checking local preflight…"
          : "Review signed handshake prerequisites"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {report ? (
        <div className="ops-status-row" role="status">
          <div>
            <strong>{report.connection_state}</strong>
            <p>
              Source-owned shell: {report.source_owned_shell_contract} ·{" "}
              {report.source_owned_shell_status}. Paths:{" "}
              {report.source_owned_shell_paths.join(", ")}
            </p>
            <p>
              Source signature: {report.claimed_signature} · independent signer:{" "}
              {report.independent_source_signer}
            </p>
            <p>
              Hub peer identity: {report.trusted_hub_peer_issuer} · isolated
              TEST tenant: {report.authorized_test_tenant}
            </p>
            <p>
              Signed private GET: {report.signed_replay_protected_get} ·
              deployment: {report.deployment_boundary}
            </p>
            <p>
              Older AI Data Platform adapter:{" "}
              {report.legacy_ai_data_platform_gateway}
            </p>
            <p>
              <strong>Required gates ({report.pending_gates.length}):</strong>{" "}
              {report.pending_gates.join(", ").replaceAll("_", " ")}
            </p>
            <p>{report.operator_action}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
