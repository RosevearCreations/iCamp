import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQl248ProvenanceGapHoldRenewal,
  classifyQl248ProvenanceGapHoldStatus,
  ql247DenialKinds,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-28T12:00:00Z");
const original = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql247WatchId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "two_sha_public_proof_provenance_recheck",
  outcomeKind: "public_proof_missing",
  nextDueAt: "2026-11-10",
  evidenceReference: "np-ql248-missing-source-proof",
  reviewNote:
    "No published original signed gateway proof exists; preserve HOLD.",
};
const transport = {
  proofPublicReference: "np-public-proof-index-145",
  sourceRevisionSha: "a".repeat(40),
  proofCommitSha: "b".repeat(40),
  proofSha256: "c".repeat(64),
  sourceCiRunUrl:
    "https://github.com/RosevearCreations/iCamp/actions/runs/12345",
};

test("Build 145 starts with missing public proof and cannot authorize a gateway", () => {
  const actual = normalizeQl248ProvenanceGapHoldRenewal(original, now);
  assert.equal(actual.proofCommitSha, null);
  assert.equal(actual.proofPublicReference, null);
  assert.equal(actual.ownerTestAuthorizationReference, null);
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...original, ...transport },
        now,
      ),
    /Missing proof cannot invent/,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        {
          ...original,
          reviewKind: "independent_authorization_hold_renewal",
          outcomeKind: "authorization_not_given_hold_renewed",
        },
        now,
      ),
    /Begin with/,
  );
});

test("QL-248 source SHA, later proof commit, original source CI and public bytes are bound", () => {
  const proof = {
    ...original,
    outcomeKind: "two_sha_reference_unverified",
    ...transport,
    signerPinSha256: "d".repeat(64),
    signerPinReference: "np-out-of-band-signer-pin",
    consumerAgreementReference: "np-consumer-amendment-unverified",
  };
  assert.equal(
    normalizeQl248ProvenanceGapHoldRenewal(proof, now).proofCommitSha,
    "b".repeat(40),
  );
  for (const variant of [
    { proofCommitSha: transport.sourceRevisionSha },
    { proofSha256: "" },
    {
      sourceCiRunUrl:
        "https://github.com/RosevearCreations/yw/actions/runs/12345",
    },
    { signerPinReference: "" },
  ])
    assert.throws(
      () =>
        normalizeQl248ProvenanceGapHoldRenewal({ ...proof, ...variant }, now),
      /distinct later proof SHA|Independent signer pin/,
    );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...proof, proofPublicReference: "" },
        now,
      ),
    /public proof index/,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...proof, sourceSystem: "yw" },
        now,
      ),
    /exact six-app repository/,
  );
});

test("Seven original denial IDs are independently named, unique and gaps never imply source proof", () => {
  const denial = {
    ...original,
    priorReviewId: original.id,
    reviewKind: "seven_denial_source_receipt_gap_aging",
    outcomeKind: "denial_source_references_unverified",
    denialReceiptIds: ql247DenialKinds.map(
      (kind, index) => `${kind}|np-original-trace-${index}`,
    ),
    denialWitnessReference: "np-independent-denial-source-audit",
  };
  assert.equal(
    normalizeQl248ProvenanceGapHoldRenewal(denial, now).denialReceiptIds.length,
    7,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...denial, denialReceiptIds: denial.denialReceiptIds.slice(1) },
        now,
      ),
    /Seven distinct references/,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        {
          ...denial,
          denialReceiptIds: [
            ...denial.denialReceiptIds.slice(0, 6),
            "dispatch_denied|np-original-trace-0",
          ],
        },
        now,
      ),
    /distinct original nonsecret/,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...denial, outcomeKind: "seven_denials_missing" },
        now,
      ),
    /Missing denials/,
  );
  const missing = normalizeQl248ProvenanceGapHoldRenewal(
    {
      ...denial,
      outcomeKind: "seven_denials_missing",
      denialReceiptIds: [],
      denialWitnessReference: "",
    },
    now,
  );
  assert.equal(missing.denialReceiptIds.length, 0);
});

test("Independent owner authorization renewal is documentary and 90-day bounded", () => {
  const renewal = {
    ...original,
    priorReviewId: original.id,
    reviewKind: "independent_authorization_hold_renewal",
    outcomeKind: "authorization_not_given_hold_renewed",
  };
  assert.equal(
    normalizeQl248ProvenanceGapHoldRenewal(renewal, now)
      .ownerTestAuthorizationReference,
    null,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        {
          ...renewal,
          ownerTestAuthorizationReference: "np-untrusted-owner-approval",
        },
        now,
      ),
    /No authorization/,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...renewal, outcomeKind: "authorization_reference_unverified_hold" },
        now,
      ),
    /Unverified authorization needs/,
  );
  assert.throws(
    () =>
      normalizeQl248ProvenanceGapHoldRenewal(
        { ...renewal, nextDueAt: "2027-04-30" },
        now,
      ),
    /within 90 days/,
  );
});

test("Build 145 statuses age independently of HOLD and do not mark proof verified", () => {
  assert.equal(
    classifyQl248ProvenanceGapHoldStatus(
      {
        review_kind: "seven_denial_source_receipt_gap_aging",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "ql248_proof_or_denial_gap_overdue_30_plus",
  );
  assert.equal(
    classifyQl248ProvenanceGapHoldStatus(original, { id: original.id }, now),
    "subsequent_independent_ql248_review_recorded",
  );
  assert.equal(
    classifyQl248ProvenanceGapHoldStatus(
      {
        review_kind: "two_sha_public_proof_provenance_recheck",
        next_due_at: "2026-11-10",
      },
      null,
      now,
    ),
    "ql248_denial_source_gap_recheck_pending",
  );
});

test("Build 145 Postgres gate, owner UI and server action never grant Phase B or dispatch", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const sql = read(
    "../database/migrations/0175_ql248_provenance_denial_gap_authorization_hold.sql",
  );
  for (const invariant of [
    "force row level security",
    "ql248_provenance_gap_hold_immutable",
    "ql248_provenance_gap_hold_guard",
    "source_revision_sha<>proof_commit_sha",
    "new.observed_denial_gap_count:=7-cardinality(new.denial_receipt_ids)",
    "predecessor.reviewed_by_user_id=new.reviewed_by_user_id",
    "base.reviewed_by_user_id=new.reviewed_by_user_id",
    "new.public_source_origin_verified:=false",
    "new.original_gateway_receipts_verified:=false",
    "new.phase_b_test_authorized:=false",
    "new.owner_pilot_authorized:=false",
    "new.dispatch_enabled:=false",
    "new.connection_state:='DISCONNECTED'",
    "new.gate_state:='HOLD'",
    "for insert to icamp_app",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing fail-closed SQL invariant: ${invariant}`,
    );
  assert.ok(
    read(
      "../lib/permanent-unit-owner-retention/recurrence-postgres.mjs",
    ).includes("recordQl248ProvenanceGapHoldRenewal"),
  );
  const path =
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/";
  assert.ok(read(path + "page.tsx").includes("Build 145"));
  assert.ok(
    read(path + "actions.ts").includes(
      "recordQl248ProvenanceGapHoldRenewalAction",
    ),
  );
});
