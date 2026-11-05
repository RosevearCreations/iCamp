import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  build203ReviewReadback,
  build203Runbook,
  validateBuild203Custody,
  validateBuild203OwnerIntent,
} from "../lib/pilot/build203-custody.mjs";

const root = new URL("../", import.meta.url);
const campgroundId = "12345678-1234-4234-8234-123456789abc";
const evidenceId = "87654321-1234-4234-8234-123456789abc";
const reviewId = "76543210-1234-4234-8234-123456789abc";
const requestId = "65432109-1234-4234-8234-123456789abc";
const claim = {
  action: "RECONCILE_SOURCE_CLAIMS",
  campgroundId,
  evidenceId,
  issuerReceiptRef: "receipt-issuer-test-01",
  issuerClaimedSha256: "a".repeat(64),
};
const intent = {
  action: "OWNER_TEST_INTENT",
  campgroundId,
  custodyReviewId: reviewId,
  requestId,
  decision: "REQUEST_ISOLATED_TEST",
  scopeAcknowledged: true,
  expiresAt: "2026-11-05T02:00:00.000Z",
};
const now = new Date("2026-11-05T01:00:00.000Z");

test("Build 203 accepts only narrowly scoped original issuer custody claims, never external authority", () => {
  const result = validateBuild203Custody(claim);
  assert.equal(result.disposition, "TWO_SOURCE_CLAIMS_UNVERIFIED");
  assert.equal(result.campgroundId, campgroundId);
  for (const field of [
    "independentlyVerified",
    "trustedPeer",
    "signedManifest",
    "ownerApproval",
    "token",
    "guestEmail",
  ])
    assert.throws(
      () => validateBuild203Custody({ ...claim, [field]: true }),
      /UNTRUSTED/,
    );
  for (const change of [
    { issuerReceiptRef: "john@example.com" },
    { issuerReceiptRef: "../../private" },
    { issuerClaimedSha256: "b".repeat(63) },
    { evidenceId: "foreign-camp" },
    { campgroundId: "other" },
    { action: "ENROLL_LIVE_PEER" },
  ])
    assert.throws(() => validateBuild203Custody({ ...claim, ...change }));
});

test("Build 203 owner TEST decision requires explicit one-hour-ish nonproduction scope and request id", () => {
  const result = validateBuild203OwnerIntent(intent, now);
  assert.equal(result.disposition, "LOCAL_OWNER_INTENT_ONLY");
  assert.equal(result.expiresAt, intent.expiresAt);
  for (const change of [
    { scopeAcknowledged: false },
    { requestId: "not-a-uuid" },
    { decision: "APPROVE_PRODUCTION" },
    { expiresAt: "2026-11-08T01:00:00Z" },
    { expiresAt: "2026-11-05T01:03:00Z" },
    { masterOwnerVerified: true },
    { action: "ACTIVATE_COMMS" },
  ])
    assert.throws(() =>
      validateBuild203OwnerIntent({ ...intent, ...change }, now),
    );
  assert.equal(
    validateBuild203OwnerIntent(
      {
        ...intent,
        decision: "WITHDRAW_ISOLATED_TEST",
        expiresAt: null,
        scopeAcknowledged: false,
      },
      now,
    ).expiresAt,
    null,
  );
  assert.throws(
    () =>
      validateBuild203OwnerIntent(
        {
          ...intent,
          decision: "WITHDRAW_ISOLATED_TEST",
          scopeAcknowledged: false,
        },
        now,
      ),
    /WITHDRAWAL/,
  );
});

test("Build 203 readback never upgrades matching source claims or owner intent into verified authority", () => {
  const review = {
    id: reviewId,
    evidence_id: evidenceId,
    issuer_receipt_ref: claim.issuerReceiptRef,
    issuer_claimed_sha256: "a".repeat(64),
    source_claimed_sha256: "a".repeat(64),
    created_at: now,
    independently_verified: true,
  };
  const owner = {
    id: requestId,
    custody_review_id: reviewId,
    decision: "REQUEST_ISOLATED_TEST",
    expires_at: intent.expiresAt,
    created_at: now,
    independent_authority: true,
  };
  const readback = build203ReviewReadback([], [review], [owner], now);
  assert.equal(
    readback.reviews[0].claimedDigestComparison,
    "CLAIMS_MATCH_NOT_VERIFIED",
  );
  assert.equal(readback.reviews[0].independentVerification, false);
  assert.equal(readback.ownerIntents[0].independentAuthority, false);
  assert.equal(
    readback.ownerIntentState,
    "SCOPED_TEST_INTENT_RECORDED_NOT_AUTHORIZED",
  );
  assert.equal(readback.connection_state, "DISCONNECTED / HOLD");
  assert.equal(readback.issuer_independently_verified, false);
  assert.equal(readback.peer_enrolled, false);
  const conflict = build203ReviewReadback(
    [],
    [{ ...review, issuer_claimed_sha256: "b".repeat(64) }],
  );
  assert.match(conflict.reviews[0].claimedDigestComparison, /CONFLICT/);
  assert.equal(
    build203ReviewReadback(
      [],
      [],
      [{ ...owner, decision: "WITHDRAW_ISOLATED_TEST", expires_at: null }],
    ).ownerIntentState,
    "OWNER_INTENT_WITHDRAWN",
  );
  assert.equal(
    build203ReviewReadback([], [], [owner], new Date("2026-11-05T03:00:00Z"))
      .ownerIntentState,
    "OWNER_INTENT_EXPIRED",
  );
});

test("Build 203 nonproduction runbook always fails closed without original issuer and master authority", () => {
  const plan = build203Runbook({
    ownerIntentState: "SCOPED_TEST_INTENT_RECORDED_NOT_AUTHORIZED",
  });
  assert.equal(plan.authorizeHandshake, false);
  assert.equal(plan.liveCallsOrMessages, false);
  assert.equal(plan.externalAuthorityVerified, false);
  assert.equal(plan.connection_state, "DISCONNECTED / HOLD");
  assert.equal(plan.steps.length, 6);
  assert.ok(
    plan.steps.every((step) => step.status === "MANUAL_EVIDENCE_REQUIRED"),
  );
});

test("Build 203 API uses role-scoped CSRF protected private GET and two distinct authorizations", () => {
  const route = readFileSync(
    new URL("app/api/it/pilot-custody/route.ts", root),
    "utf8",
  );
  assert.match(
    route,
    /requireAnyCampgroundPermission\(\s*"pilot\.custody\.reconcile"/,
  );
  assert.match(route, /"pilot\.test\.authorize"/);
  assert.match(route, /request\.headers\.get\("origin"\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /content-length/);
  assert.doesNotMatch(route, /verifyICampShellGet|fetch\("https?:\/\//);
});

test("Build 203 database binds custody and owner claims to tenant, second reviewer and immutable ledger", () => {
  const sql = readFileSync(
    new URL("database/migrations/0215_build203_custody_owner_test.sql", root),
    "utf8",
  );
  assert.match(sql, /force row level security/g);
  assert.match(sql, /pilot203_review_immutable before update or delete/);
  assert.match(sql, /pilot203_owner_immutable before update or delete/);
  assert.match(
    sql,
    /e\.actor_user_id<>\(select icamp_private\.request_user_id\(\)\)/,
  );
  assert.match(sql, /foreign key\(evidence_id,organization_id,campground_id\)/);
  assert.match(
    sql,
    /foreign key\(custody_review_id,organization_id,campground_id\)/,
  );
  assert.match(sql, /independent_authority=false/);
  assert.match(sql, /independently_verified=false/);
  assert.doesNotMatch(sql, /grant .*update|grant .*delete/i);
});
