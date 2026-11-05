import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runBuild202ScopedTestWitness } from "../lib/integration-v1/build202-scoped-test-witness.mjs";
import {
  build202EvidenceReadback,
  validateBuild202Evidence,
} from "../lib/pilot/build202-evidence.mjs";

const root = new URL("../", import.meta.url);
const input = {
  campgroundId: "12345678-1234-4234-8234-123456789abc",
  sourceClass: "real_device",
  evidenceRef: "receipt-2026-000001",
  claimedSha256: "a".repeat(64),
  deviceProfile: "PHONE_TOUCH",
};

test("Build 202 canonical pilot intake only accepts scoped, non-sensitive source reference and claimed digest", () => {
  const result = validateBuild202Evidence(input);
  assert.equal(result.disposition, "SUBMITTED_UNVERIFIED");
  assert.equal(result.independentVerification, false);
  assert.equal(result.campgroundId, input.campgroundId);
  assert.deepEqual(
    validateBuild202Evidence({
      ...input,
      sourceClass: "hub_peer_enrollment",
      deviceProfile: null,
    }).sourceClass,
    "hub_peer_enrollment",
  );
  for (const extra of [
    "independentVerification",
    "ownerApproval",
    "isTrusted",
    "token",
    "guestName",
  ])
    assert.throws(
      () => validateBuild202Evidence({ ...input, [extra]: true }),
      /UNTRUSTED/,
    );
});

test("Build 202 rejects invalid PII-shaped IDs, unknown device, unsafe digest, cross-category and foreign scope", () => {
  for (const change of [
    { evidenceRef: "john@example.com" },
    { evidenceRef: "123-456-789" },
    { evidenceRef: "../../secrets" },
    { claimedSha256: "f".repeat(63) },
    { claimedSha256: "Z".repeat(64) },
    { deviceProfile: "PRIVATE_PHONE_SERIAL" },
    { campgroundId: "other-campground" },
    { sourceClass: "trusted_issuer" },
    { sourceClass: "hub_peer_enrollment", deviceProfile: "PHONE_TOUCH" },
  ])
    assert.throws(() => validateBuild202Evidence({ ...input, ...change }));
});

test("Build 202 review readback strips upstream self-claimed independent approval", () => {
  const report = build202EvidenceReadback([
    {
      id: "fixture",
      source_class: "independent_source_signer",
      evidence_ref: "receipt-2026-source",
      claimed_sha256: "a".repeat(64),
      device_profile: null,
      created_at: "2026-11-04T00:00:00.000Z",
      independent_verification: true,
      disposition: "TRUSTED",
      private_connection_active: true,
    },
  ]);
  assert.equal(report.rows[0].independentVerification, false);
  assert.equal(report.rows[0].disposition, "SUBMITTED_UNVERIFIED");
  assert.equal(report.peer_enrollment, "NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(report.connection_state, "DISCONNECTED / HOLD");
  assert.equal(report.no_activation_or_external_dispatch, true);
});

test("Build 202 cryptographic shell witness is entirely synthetic, non-replayed, scoped and fail-closed", async () => {
  const report = await runBuild202ScopedTestWitness();
  for (const label of [
    "signed_health_fixture",
    "signed_capabilities_fixture",
    "nonce_replay_denied",
    "wrong_issuer_denied",
    "tenant_query_denied",
    "production_denied",
    "missing_authority_denied",
    "missing_kms_denied",
  ])
    assert.equal(report[label], "PASS", label);
  assert.equal(report.live_handshake_attempted, false);
  assert.equal(report.hosted_nonce_replay_database_tested, false);
  assert.equal(report.external_source_signer_verified, false);
  assert.equal(report.private_connection_active, false);
  assert.equal(report.external_requests_or_writes, false);
});

test("Build 202 private API requires per-campground permission, blocks CSRF and sends no external handshake", () => {
  const route = readFileSync(
    new URL("app/api/it/pilot-evidence/route.ts", root),
    "utf8",
  );
  assert.match(
    route,
    /requireAnyCampgroundPermission\(\s*"pilot\.evidence\.review"/,
  );
  assert.match(
    route,
    /requireCampgroundPermission\(\s*normalized\.campgroundId,\s*"pilot\.evidence\.intake"/,
  );
  assert.match(route, /request\.headers\.get\("origin"\)/);
  assert.match(route, /content-length/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(route, /verifyICampShellGet|fetch\("https?:\/\//);
});

test("Build 202 database constraints are RLS, append-only, actor-bound and never certify authenticity", () => {
  const sql = readFileSync(
    new URL(
      "database/migrations/0214_build202_pilot_evidence_intake.sql",
      root,
    ),
    "utf8",
  );
  assert.match(sql, /force row level security/);
  assert.match(sql, /pilot202_evidence_immutable before update or delete/);
  assert.match(
    sql,
    /actor_user_id=\(select icamp_private\.request_user_id\(\)\)/,
  );
  assert.match(sql, /independent_verification=false/);
  assert.match(sql, /SUBMITTED_UNVERIFIED/);
  assert.match(sql, /pilot\.evidence\.intake/);
  assert.match(sql, /pilot\.evidence\.review/);
  assert.doesNotMatch(sql, /grant .*update|grant .*delete/i);
});
