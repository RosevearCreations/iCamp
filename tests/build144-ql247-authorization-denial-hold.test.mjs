import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQl247TestReceiptHoldWatch,
  classifyQl247TestReceiptHoldStatus,
  ql247DenialKinds,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
import { createHash } from "node:crypto";
import { inspectQl248TwoShaProofTransport } from "../lib/integration-v1/ql246-source-proof.mjs";

const now = new Date("2026-10-28T12:00:00Z");
const original = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql246HoldDecisionId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "nonproduction_test_authorization_evidence_intake",
  outcomeKind: "authorization_not_given",
  nextDueAt: "2026-11-10",
  evidenceReference: "np-real-owner-test-ledger",
  reviewNote:
    "No authenticated owner Phase B authorization exists; continue HOLD.",
};

test("Build 144 documents missing authorization, not test permission", () => {
  const actual = normalizeQl247TestReceiptHoldWatch(original, now);
  assert.equal(actual.authorizationReferenceStatus, "NOT_GIVEN");
  assert.equal(actual.testAuthorizationReference, null);
  assert.equal(actual.sourceRevisionSha, null);
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...original,
          outcomeKind: "authorization_reference_unverified",
        },
        now,
      ),
    /requires an actual/,
  );
  assert.equal(
    normalizeQl247TestReceiptHoldWatch(
      {
        ...original,
        outcomeKind: "authorization_reference_unverified",
        authorizationReferenceStatus: "REFERENCE_UNVERIFIED",
        testAuthorizationReference: "np-independent-approval-reference",
      },
      now,
    ).authorizationReferenceStatus,
    "REFERENCE_UNVERIFIED",
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...original,
          authorizationReferenceStatus: "AUTHORIZED",
        },
        now,
      ),
    /NOT GIVEN or REFERENCE UNVERIFIED/,
  );
});

test("Build 144 separates source commit, later proof commit, raw digest and source CI", () => {
  const proof = {
    ...original,
    outcomeKind: "authorization_exception_escalated",
    sourceRevisionSha: "a".repeat(40),
    proofCommitSha: "b".repeat(40),
    proofSha256: "c".repeat(64),
    ciRunUrl: "https://github.com/RosevearCreations/iCamp/actions/runs/123456",
  };
  assert.equal(
    normalizeQl247TestReceiptHoldWatch(proof, now).proofCommitSha,
    "b".repeat(40),
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        { ...proof, proofCommitSha: proof.sourceRevisionSha },
        now,
      ),
    /distinct proof-bearing commit/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch({ ...proof, proofSha256: "" }, now),
    /must all accompany/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...proof,
          ciRunUrl:
            "https://github.com/RosevearCreations/yw/actions/runs/123456",
        },
        now,
      ),
    /same-repository source CI/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...original,
          outcomeKind: "two_sha_transport_pending",
          sourceRevisionSha: proof.sourceRevisionSha,
          proofCommitSha: proof.proofCommitSha,
          proofSha256: proof.proofSha256,
          ciRunUrl: proof.ciRunUrl,
        },
        now,
      ),
    /only a proposed clarification/,
  );
});

test("QL-248 offline raw-proof transport distinguishes the two commits without asserting GitHub provenance", () => {
  const originalSource = "a".repeat(40);
  const bytes = Buffer.from(
    JSON.stringify({
      payload: {
        repository: "RosevearCreations/iCamp",
        source_revision: originalSource,
        ci_run_url:
          "https://github.com/RosevearCreations/iCamp/actions/runs/555",
      },
    }),
  );
  const manifest = {
    sourceRevisionSha: originalSource,
    proofCommitSha: "b".repeat(40),
    proofSha256: createHash("sha256").update(bytes).digest("hex"),
    ciRunUrl: "https://github.com/RosevearCreations/iCamp/actions/runs/555",
  };
  const check = inspectQl248TwoShaProofTransport(bytes, manifest);
  assert.equal(
    check.status,
    "TRANSPORT_METADATA_MATCHED_ORIGIN_UNVERIFIED_HOLD",
  );
  assert.equal(check.originIndependentlyVerified, false);
  assert.equal(check.sourceSignatureVerified, false);
  assert.equal(check.sevenDenialsIndependentlyWitnessed, false);
  assert.equal(check.connectionState, "DISCONNECTED");
  assert.equal(
    inspectQl248TwoShaProofTransport(bytes, {
      ...manifest,
      proofCommitSha: originalSource,
    }).status,
    "PENDING_BLOCKED",
  );
  assert.equal(
    inspectQl248TwoShaProofTransport(bytes, {
      ...manifest,
      proofSha256: "c".repeat(64),
    }).status,
    "PENDING_BLOCKED",
  );
});

test("Build 144 ties exactly seven named original receipt IDs to an independent witness while staying unverified", () => {
  assert.deepEqual(ql247DenialKinds, [
    "nonce_replay_denied",
    "stale_request_denied",
    "cross_business_denied",
    "cross_tenant_denied",
    "revoked_key_denied",
    "write_denied",
    "dispatch_denied",
  ]);
  const denials = {
    ...original,
    priorReviewId: original.id,
    reviewKind: "independent_seven_denial_receipt_reconciliation",
    outcomeKind: "denial_references_unverified",
    denialReceiptIds: ql247DenialKinds.map(
      (key, i) => `${key}|np-genuine-receipt-${i}`,
    ),
    denialWitnessReference: "np-independent-witness-reference",
  };
  assert.equal(
    normalizeQl247TestReceiptHoldWatch(denials, now).denialReceiptIds.length,
    7,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        { ...denials, denialReceiptIds: denials.denialReceiptIds.slice(1) },
        now,
      ),
    /seven distinct/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...denials,
          denialReceiptIds: denials.denialReceiptIds.map((value, i) =>
            i === 6 ? "dispatch_denied|np-genuine-receipt-0" : value,
          ),
        },
        now,
      ),
    /seven distinct, named/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...denials,
          denialReceiptIds: ["write_denied|raw-secret-token"],
        },
        now,
      ),
    /nonsecret original/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...denials,
          outcomeKind: "seven_denials_missing",
        },
        now,
      ),
    /must not list fabricated/,
  );
  assert.throws(
    () =>
      normalizeQl247TestReceiptHoldWatch(
        {
          ...original,
          reviewKind: "reversible_hold_decision_watch",
          outcomeKind: "hold_reaffirmed",
        },
        now,
      ),
    /Begin with/,
  );
});

test("Build 144 follow-up aging is independent of immutable DISCONNECTED/HOLD", () => {
  assert.equal(
    classifyQl247TestReceiptHoldStatus(
      {
        review_kind: "independent_seven_denial_receipt_reconciliation",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "ql247_denial_or_hold_overdue_30_plus",
  );
  assert.equal(
    classifyQl247TestReceiptHoldStatus(
      {
        review_kind: "reversible_hold_decision_watch",
        next_due_at: "2026-11-10",
      },
      null,
      now,
    ),
    "ql247_authorization_evidence_renewal_pending",
  );
  assert.equal(
    classifyQl247TestReceiptHoldStatus(original, { id: original.id }, now),
    "subsequent_independent_ql247_review_recorded",
  );
});

test("Build 144 schema, server action and UI preserve owner isolation and no approvals", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const sql = read(
    "../database/migrations/0174_ql247_nonproduction_authorization_denials_hold.sql",
  );
  for (const check of [
    "force row level security",
    "ql247_test_receipt_hold_immutable",
    "ql247_test_receipt_hold_guard",
    "phase_b_test_authorized=false",
    "new.seven_denials_independently_witnessed:=false",
    "new.owner_pilot_authorized:=false",
    "new.dispatch_enabled:=false",
    "new.connection_state:='DISCONNECTED'",
    "new.gate_state:='HOLD'",
    "source_revision_sha<>proof_commit_sha",
    "cardinality(new.denial_receipt_ids)<>7",
    "source_campground_id",
    "for insert to icamp_app with check",
  ])
    assert.ok(
      sql.includes(check),
      `Missing fail-closed SQL invariant ${check}`,
    );
  assert.ok(
    read(
      "../lib/permanent-unit-owner-retention/recurrence-postgres.mjs",
    ).includes("recordQl247TestReceiptHoldWatch"),
  );
  const path =
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/";
  assert.ok(read(path + "page.tsx").includes("Build 144"));
  assert.ok(
    read(path + "actions.ts").includes("recordQl247TestReceiptHoldWatchAction"),
  );
});
