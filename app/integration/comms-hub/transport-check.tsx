"use client";

import { useState } from "react";

type Readback = {
  transport: string;
  response_code: number | null;
  signed_source_identity: string;
  authenticated_gateway_get: string;
  connection_state: string;
};

export function CommsTransportCheck() {
  const [report, setReport] = useState<Readback | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function checkTransport() {
    setBusy(true);
    setMessage("");
    setReport(null);
    try {
      const response = await fetch("/api/it/comms-hub/transport", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "manual",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("json")
      )
        throw new Error(
          "Secure staff sign-in or a reachable source is required.",
        );
      setReport((await response.json()) as Readback);
    } catch {
      setMessage(
        "Readback unavailable. Sign in with I.T. privileges, then retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="content-panel ops-detail-card"
      aria-labelledby="build200-transport-title"
    >
      <div className="ops-section-heading">
        <div>
          <p className="eyebrow">Build 200 · network and trust separated</p>
          <h2 id="build200-transport-title">Comms Hub transport readback</h2>
        </div>
        <span className="ops-pill ops-pill--hold">
          Authenticated connection HELD
        </span>
      </div>
      <p>
        This restricted, server-side check makes one HTTPS request to the
        allowlisted <strong>public Comms Hub homepage</strong>. It never
        forwards a key, token, guest record or command. Public reachability is
        not proof of a signed cross-app session.
      </p>
      <button
        className="primary-button"
        type="button"
        onClick={checkTransport}
        disabled={busy}
      >
        {busy
          ? "Checking secure transport…"
          : "Check Comms Hub HTTPS transport"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {report ? (
        <div className="ops-status-row" role="status">
          <div>
            <strong>{report.transport}</strong>
            <p>
              HTTP: {report.response_code ?? "unavailable"}; signed peer:{" "}
              {report.signed_source_identity}
            </p>
            <p>
              Private signed GET: {report.authenticated_gateway_get};
              connection: {report.connection_state}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
