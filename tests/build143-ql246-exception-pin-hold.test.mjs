import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQl246ExceptionPinHoldDecision,
  classifyQl246ExceptionPinHoldStatus,
  ql247SourceRepositories,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-28T12:00:00Z");
const source = {
  id: "a1111111-1111-4111-8111-111111111111",
  sourcePinReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "independent_source_proof_exception_intake",
  outcomeKind: "proof_missing",
  sourceProofStatus: "MISSING",
  nextDueAt: "2026-11-07",
  evidenceReference: "np-build143-source-index",
  reviewNote:
    "QL-246 original signed evidence is still missing from the public source review.",
};

test("Build 143 maps exactly six independent source repositories and accepts honest missing proof", () => {
  assert.deepEqual(Object.entries(ql247SourceRepositories), [
    ["ai-data-platform", "RosevearCreations/ai-data-platform"],
    ["devilndove", "RosevearCreations/devilndove-site"],
    ["rosiedazzlers", "RosevearCreations/rosiedazzlers"],
    ["yw", "RosevearCreations/yw"],
    ["icamp", "RosevearCreations/iCamp"],
    ["rosevear-ai-hub", "RosevearCreations/rosevear-ai-hub"],
  ]);
  assert.equal(
    normalizeQl246ExceptionPinHoldDecision(source, now).sourceProofStatus,
    "MISSING",
  );
  assert.equal(
    normalizeQl246ExceptionPinHoldDecision(
      {
        ...source,
        sourceRevision: "a".repeat(40),
        ciRunUrl:
          "https://github.com/RosevearCreations/iCamp/actions/runs/12345",
      },
      now,
    ).sourceRevision,
    "a".repeat(40),
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...source,
          repository: "RosevearCreations/yw",
        },
        now,
      ),
    /exact independently checked/,
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...source,
          sourceRevision: "a".repeat(40),
          ciRunUrl:
            "https://github.com/RosevearCreations/yw/actions/runs/12345",
        },
        now,
      ),
    /same repository/,
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...source,
          proofRawJsonSha256: "b".repeat(64),
        },
        now,
      ),
    /Missing proof/,
  );
});

test("Build 143 follows three independent phases and does not fabricate proof, pin or challenges", () => {
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...source,
          reviewKind: "out_of_band_pin_challenge_reconciliation",
          outcomeKind: "pin_not_provisioned",
        },
        now,
      ),
    /Begin with independent/,
  );
  const pin = {
    ...source,
    priorReviewId: source.id,
    reviewKind: "out_of_band_pin_challenge_reconciliation",
    outcomeKind: "pin_not_provisioned",
  };
  assert.equal(
    normalizeQl246ExceptionPinHoldDecision(pin, now).publicSignerSpkiSha256,
    null,
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...pin,
          operatorChallengeId: "np-real-public-challenge",
        },
        now,
      ),
    /together/,
  );
  const trust = {
    ...pin,
    outcomeKind: "pin_independence_unverified",
    publicSignerSpkiSha256: "a".repeat(64),
    outOfBandSpkiSha256: "a".repeat(64),
    outOfBandReference: "np-real-independent-channel",
    operatorChallengeId: "np-real-public-challenge",
    operatorChallengeSha256: "c".repeat(64),
  };
  assert.equal(
    normalizeQl246ExceptionPinHoldDecision(trust, now).outOfBandReference,
    "np-real-independent-channel",
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...trust,
          outOfBandSpkiSha256: "d".repeat(64),
        },
        now,
      ),
    /matching public fingerprints/,
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...pin,
          sourceProofStatus: "VERIFIED",
          outcomeKind: "pin_not_provisioned",
        },
        now,
      ),
    /cannot be marked accepted/,
  );
  const gate = {
    ...pin,
    reviewKind: "multi_application_hold_gate_decision",
    outcomeKind: "owner_test_authorization_absent",
  };
  assert.equal(
    normalizeQl246ExceptionPinHoldDecision(gate, now).outcomeKind,
    "owner_test_authorization_absent",
  );
  assert.throws(
    () =>
      normalizeQl246ExceptionPinHoldDecision(
        {
          ...gate,
          nextDueAt: "2027-05-01",
        },
        now,
      ),
    /within 90 days/,
  );
});

test("Build 143 reviewer aging remains an audit, not a gateway approval", () => {
  assert.equal(
    classifyQl246ExceptionPinHoldStatus(
      {
        review_kind: "multi_application_hold_gate_decision",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "ql246_exception_overdue_30_plus",
  );
  assert.equal(
    classifyQl246ExceptionPinHoldStatus(
      {
        review_kind: "independent_source_proof_exception_intake",
        next_due_at: "2026-11-10",
      },
      null,
      now,
    ),
    "ql246_source_exception_intake_pending",
  );
  assert.equal(
    classifyQl246ExceptionPinHoldStatus(source, { id: source.id }, now),
    "subsequent_independent_ql246_review_recorded",
  );
});

test("Build 143 schema has owner-only forced RLS, immutable HOLD and six-app independent roots", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const sql = read(
    "../database/migrations/0173_ql246_exception_pin_multisystem_hold.sql",
  );
  for (const fragment of [
    "force row level security",
    "for insert to icamp_app with check",
    "ql246_exception_pin_hold_immutable",
    "ql246_exception_pin_hold_guard",
    "(source_pin_review_id,source_system)",
    "phase_b_test_authorized=false",
    "new.owner_pilot_authorized:=false",
    "new.connection_state:='DISCONNECTED'",
    "new.gate_state:='HOLD'",
    "observed_six_app_source_kinds",
    "public_signer_spki_sha256",
    "out_of_band_spki_sha256",
    "operator_challenge_sha256",
    "independent_source_proof_exception_intake",
  ])
    assert.ok(
      sql.includes(fragment),
      `Missing QL-246 fail-closed invariant: ${fragment}`,
    );
  const ledger = read(
    "../lib/permanent-unit-owner-retention/recurrence-postgres.mjs",
  );
  assert.ok(ledger.includes("recordQl246ExceptionPinHoldDecision"));
  assert.ok(ledger.includes("ql246ExceptionPinHoldDecisions"));
  const path =
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/";
  assert.ok(read(path + "page.tsx").includes("Build 143"));
  assert.ok(
    read(path + "actions.ts").includes(
      "recordQl246ExceptionPinHoldDecisionAction",
    ),
  );
});
