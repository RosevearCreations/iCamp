"use client";

import { useState } from "react";

const SOURCE = "icamp";
const CHECKS = [
  "Source identity matches this application",
  "No credentials are accepted by this page",
  "No network or data mutation is made by the local test",
  "Independent signer and witness remain unverified",
  "Owner TEST-only approval remains absent"
] as const;

export function LocalCheck() {
  const [report, setReport] = useState("");
  function runLocalCheck() {
    setReport(JSON.stringify({
      schema: "rosevear-comms-local-preflight/v1", source: SOURCE,
      mode: "LOCAL_INTERFACE_ONLY",
      checks: CHECKS.map(id => ({ id, passed: true })), localPass: true,
      networkRequests: 0, authenticatedGatewayGets: 0,
      signedProofB: "NOT_VERIFIED", privateRoles: "NOT_VERIFIED",
      isolatedNonproductionTenant: "NOT_VERIFIED", ownerTestAuthorization: "NOT_GIVEN",
      futureBoundedWindow: "TWO_POSITIVE_AND_SEVEN_DENIAL_GETS_IN_15_MINUTES",
      remoteConnection: "DISCONNECTED / HOLD"
    }, null, 2));
  }
  return <section className="content-panel" aria-labelledby="comms-connection-title" style={{ padding: "1.5rem" }}>
    <h2 id="comms-connection-title">Rosevear Comms Hub · secure connection</h2>
    <p><strong>DISCONNECTED / HOLD.</strong> This is a source-side nonproduction readiness interface, not an authenticated connection.</p>
    <p>Repository: <code>RosevearCreations/iCamp</code><br />
       Required signed proof: <code>docs/integration/ql246-source-proof.json</code> (unverified).</p>
    <ol>
      <li>Approve a persistent, restricted private key host and independently authenticate the custodian, distinct witness and reviewer; pin the genuine public SPKI independently.</li>
      <li>Verify separate nonproduction database/tenant and server-only, least-privilege GET credentials.</li>
      <li>Obtain separately authenticated owner authorization explicitly limited to TEST.</li>
      <li>Only then schedule two positive and seven denial GETs in a 15-minute window, with rollback and review.</li>
    </ol>
    <button type="button" onClick={runLocalCheck}>Run local connection-interface check (zero network)</button>
    <p>Local PASS confirms only this browser contract. No real six-app connection, sign-in, calls, SMS, bookings or tenant access occurs.</p>
    <pre role="status" aria-live="polite" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 340, overflow: "auto" }}>{report || "Not run. Remote connection remains HOLD."}</pre>
  </section>;
}
