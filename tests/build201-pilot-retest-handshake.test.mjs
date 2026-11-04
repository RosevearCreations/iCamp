import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILD200_JOURNEYS } from "../lib/pilot/build200-pilot.mjs";
import {
  BUILD201_DEVICE_PROFILES,
  BUILD201_FINDING_STATES,
  BUILD201_MAX_FINDINGS,
  BUILD201_RETEST_SCHEMA,
  build201RetestPacket,
  importBuild201Retest,
  normalizeBuild201Findings,
} from "../lib/pilot/build201-retest.mjs";
import { build201HandshakePreflight } from "../lib/integration-v1/build201-handshake-preflight.mjs";
import { runBuild201SyntheticHandshake } from "../lib/integration-v1/build201-synthetic-drill.mjs";

const root = new URL("../", import.meta.url);
const valid = {
  journey: BUILD200_JOURNEYS[0].id,
  device: "PHONE_TOUCH",
  state: "RETEST_REPORTED_PASS",
  ticket_ref: "issue-pilot-2026-001",
  evidence_ref: "receipt-device-2026-001",
};

test("Build 201 enumerates real device retest profiles but no automated physical-device attestation", () => {
  assert.equal(BUILD201_DEVICE_PROFILES.length, 5);
  assert.ok(BUILD201_DEVICE_PROFILES.includes("SCREEN_READER_KEYBOARD"));
  assert.ok(BUILD201_DEVICE_PROFILES.includes("OFFLINE_RECOVERY"));
  assert.ok(BUILD201_FINDING_STATES.includes("RETEST_REPORTED_PASS"));
  assert.equal(BUILD201_MAX_FINDINGS, 24);
  assert.equal(BUILD200_JOURNEYS.length, 7);
});

test("Build 201 retest packet survives source checksums and never self-authorizes", async () => {
  const rows = normalizeBuild201Findings([valid], BUILD200_JOURNEYS);
  assert.equal(rows[0].independently_witnessed, false);
  const packet = await build201RetestPacket(rows, BUILD200_JOURNEYS);
  assert.equal(packet.schema, BUILD201_RETEST_SCHEMA);
  assert.equal(packet.counts.RETEST_REPORTED_PASS, 1);
  assert.equal(packet.real_device_witness, "UNVERIFIED");
  assert.equal(packet.independent_signoff, "MISSING");
  assert.equal(packet.signed_comms_hub_peer, "MISSING");
  assert.equal(packet.go_live_decision, "NO_GO_PENDING_EVIDENCE");
  assert.equal(packet.external_effects, false);
  assert.equal(packet.source_sha256.length, 64);
  assert.equal(
    packet.source_sha256,
    createHash("sha256")
      .update(
        JSON.stringify({ schema: BUILD201_RETEST_SCHEMA, rows: packet.rows }),
      )
      .digest("hex"),
  );
  assert.deepEqual(await build201RetestPacket(rows, BUILD200_JOURNEYS), packet);
});

test("Build 201 portable import discards forged witness, authorization, producer and signature fields", () => {
  const forged = {
    schema: BUILD201_RETEST_SCHEMA,
    build: 201,
    rows: [
      {
        ...valid,
        independently_witnessed: true,
        staff_identity: "someone",
        signature: "fake",
      },
    ],
    go_live_decision: "GO",
    private_connection_active: true,
    issuer: "trusted-comms-hub",
    owner_approved: true,
  };
  const imported = importBuild201Retest(
    JSON.stringify(forged),
    BUILD200_JOURNEYS,
  );
  assert.deepEqual(imported, [{ ...valid, independently_witnessed: false }]);
  assert.doesNotMatch(
    JSON.stringify(imported),
    /someone|fake|GO|trusted-comms/,
  );
});

test("Build 201 strictly rejects PII-like refs, unrecognized journeys, states, profiles, duplicates and oversized imports", () => {
  const bad = [
    { ...valid, ticket_ref: "guest@example.com" },
    { ...valid, ticket_ref: "1234-5555-6666-7777" },
    { ...valid, ticket_ref: "issue-1" },
    { ...valid, evidence_ref: "phone:+14165551212" },
    { ...valid, journey: "/owner/other-tenant" },
    { ...valid, device: "PRODUCTION_GATE_PASS" },
    { ...valid, state: "SIGNOFF_APPROVED" },
  ];
  for (const entry of bad)
    assert.throws(() => normalizeBuild201Findings([entry], BUILD200_JOURNEYS));
  assert.throws(
    () => normalizeBuild201Findings([valid, valid], BUILD200_JOURNEYS),
    /DUPLICATE/,
  );
  assert.throws(() =>
    normalizeBuild201Findings(Array(25).fill(valid), BUILD200_JOURNEYS),
  );
  assert.throws(() =>
    importBuild201Retest("x".repeat(24_001), BUILD200_JOURNEYS),
  );
  assert.throws(() => importBuild201Retest("{broken", BUILD200_JOURNEYS));
  assert.throws(() =>
    importBuild201Retest(
      JSON.stringify({ schema: "different", rows: [valid] }),
      BUILD200_JOURNEYS,
    ),
  );
});

test("Build 201 original public manifest and unverified claimed signature cannot count as trusted Hub peer", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("public/.well-known/rosevear-integration-manifest.json", root),
      "utf8",
    ),
  );
  const report = build201HandshakePreflight({
    manifest,
    environment: "production",
  });
  assert.equal(report.reviewed_manifest_schema, "EXPECTED");
  assert.equal(
    report.source_owned_shell_contract,
    "rosevear.shell.nonproduction.v1",
  );
  assert.deepEqual(report.source_owned_shell_paths, [
    "/api/integration/v1/shell/health",
    "/api/integration/v1/shell/capabilities",
  ]);
  assert.equal(
    report.source_owned_shell_status,
    "ENDPOINTS_PRESENT_NO_INDEPENDENT_TEST_AUTHORITY",
  );
  assert.equal(report.claimed_signature, "MISSING");
  assert.equal(report.trusted_hub_peer_issuer, "NOT_VERIFIED_IN_ICAMP");
  assert.equal(report.deployment_boundary, "PRODUCTION_PRIVATE_GATE_DISABLED");
  assert.equal(report.ready_for_authenticated_peer_test, false);
  assert.equal(report.private_connection_active, false);
  assert.equal(report.no_external_requests_or_writes, true);
  const forged = build201HandshakePreflight({
    manifest: {
      ...manifest,
      signature: {
        algorithm: "Ed25519",
        key_id: "claimed",
        value: "not-verified",
        state: "VERIFIED",
      },
      transport: { origin: "https://claimed.example" },
      connection_state: "ACTIVE",
    },
    environment: "preview",
    legacyGatewayConfigured: true,
  });
  assert.equal(forged.claimed_signature, "PRESENT_NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(forged.private_connection_active, false);
  assert.equal(forged.ready_for_authenticated_peer_test, false);
  assert.equal(forged.connection_state, "DISCONNECTED / HOLD");
  assert.equal(
    forged.legacy_ai_data_platform_gateway,
    "SEPARATE_TEST_GATEWAY_CONFIGURED_NOT_COMMS_HUB",
  );
});

test("Build 201 synthetic cryptographic drill is local, rejects wrong issuer, tenant, expiry and tampering", () => {
  const report = runBuild201SyntheticHandshake();
  for (const key of [
    "isolated_test_signature",
    "cross_tenant_denial",
    "wrong_issuer_denial",
    "signature_tamper_denial",
    "signature_expiry_denial",
    "production_enablement_denial",
  ])
    assert.equal(report[key], "PASS");
  assert.equal(report.actual_comms_hub_signed_handshake, "NOT_ATTEMPTED");
  assert.equal(report.replay_database_receipt, "NOT_TESTED_DB_REQUIRED");
  assert.equal(report.external_witness, "MISSING");
  assert.equal(report.live_connection, "DISCONNECTED / HOLD");
  assert.equal(report.external_requests, false);
  assert.equal(report.external_writes, false);
});

test("Build 201 preflight route is I.T.-restricted, read-only and does not accept a request-selected host", () => {
  const code = readFileSync(
    new URL("app/api/it/comms-hub/handshake-preflight/route.ts", root),
    "utf8",
  );
  assert.match(
    code,
    /requireAnyCampgroundPermission\(\s*"it\.integration\.read"/,
  );
  assert.match(code, /new URL\(request\.url\)\.search/);
  assert.match(code, /private, no-store/);
  assert.doesNotMatch(code, /export async function (POST|PUT|PATCH)/);
  const component = readFileSync(
    new URL("app/pilot/acceptance/build201-retest.tsx", root),
    "utf8",
  );
  assert.match(component, /sessionStorage\.setItem/);
  assert.match(component, /importBuild201Retest/);
  assert.match(component, /target="_blank"/);
  assert.doesNotMatch(component, /localStorage\.setItem/);
});
