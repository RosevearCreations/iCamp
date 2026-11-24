import test from "node:test";
import assert from "node:assert/strict";
import {
  validateFieldReview278,
  validateMfaReview278,
  validateExternalReadback278,
  summarizeField278,
  summarizeOwner278,
  summarizeRestore278,
  classifyClosure278,
} from "../lib/build278/core.mjs";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sha = "b".repeat(64);
const now = Date.parse("2026-11-24T12:00:00Z");
test("invalid external input or missing original witnessed records fail closed", () => {
  assert.equal(
    validateFieldReview278({ responseId: id, evidenceDigest: sha }).responseId,
    id,
  );
  assert.throws(() =>
    validateFieldReview278({ responseId: "invalid", evidenceDigest: sha }),
  );
  assert.throws(() =>
    validateMfaReview278({
      sessionId: id,
      ownerId: owner,
      evidenceDigest: "short",
    }),
  );
  assert.throws(() =>
    validateExternalReadback278({
      externalReviewId: id,
      providerDigest: sha,
      isolatedDigest: sha,
      evidenceDigest: sha,
    }),
  );
});
test("seven field sources need both fresh cryptographic receipt and independent review", () => {
  const old = new Date(now - 360000).toISOString();
  const r = summarizeField278(
    [
      {
        source: "icamp",
        acceptedAt: old,
        reviewedAt: old,
        cryptographic: true,
      },
    ],
    now,
  );
  assert.equal(r.reviewedCount, 0);
  assert.equal(r.peers.length, 7);
  const recent = new Date(now - 120000).toISOString(),
    review = new Date(now - 100000).toISOString();
  const x = summarizeField278(
    [
      {
        source: "icamp",
        acceptedAt: recent,
        reviewedAt: review,
        cryptographic: true,
      },
    ],
    now,
  );
  assert.equal(x.reviewedCount, 1);
  assert.equal(
    summarizeField278(
      [
        {
          source: "icamp",
          acceptedAt: recent,
          reviewedAt: review,
          cryptographic: false,
        },
      ],
      now,
    ).reviewedCount,
    0,
  );
});
test("MFA review only counts current original Rosevear AAL2 session", () => {
  const original = {
    status: "OWNER_EVIDENCE_PRESENT_INDEPENDENT_REVIEW_REQUIRED",
  };
  const session = {
    sessionId: id,
    assuranceLevel: "aal2",
    user: { id: owner, username: "Rosevear" },
  };
  assert.equal(
    summarizeOwner278(original, session, { ownerId: owner, sessionId: id })
      .status,
    "ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION",
  );
  assert.equal(
    summarizeOwner278(
      original,
      { ...session, assuranceLevel: "aal1" },
      { ownerId: owner, sessionId: id },
    ).status,
    "HOLD_ORIGINAL_OWNER_MFA_RECOVERY_COMPLETION",
  );
  assert.equal(
    summarizeOwner278(original, session, {
      ownerId: owner,
      sessionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    }).status,
    "HOLD_ORIGINAL_OWNER_MFA_RECOVERY_COMPLETION",
  );
});
test("external evidence cannot assert actual production restore or provider certification", () => {
  const restore = summarizeRestore278([{ independent: true }]);
  const closure = classifyClosure278({
    host: { pinned: true },
    migrationAdopted: true,
    owner: {
      status: "ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION",
    },
    peers: { reviewedCount: 7 },
    restore,
  });
  assert.equal(closure.productionRestored, false);
  assert.equal(closure.providerCertified, false);
  assert.equal(
    classifyClosure278({
      host: { pinned: false },
      migrationAdopted: true,
      owner: {
        status: "ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION",
      },
      peers: { reviewedCount: 7 },
      restore,
    }).status,
    "HOLD_ORIGINAL_RECOVERY_FIELD_CLOSURE",
  );
});
