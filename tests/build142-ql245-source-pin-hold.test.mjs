import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import {
  normalizeQl245SourcePinHoldReview,
  classifyQl245SourcePinHoldStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
import {
  QL246_FIELDS,
  QL246_NEGATIVE_TESTS,
  canonicalQl246Payload,
  assessQl246SourceProof,
} from "../lib/integration-v1/ql246-source-proof.mjs";

const now = new Date("2026-10-28T12:00:00.000Z");
const source = {
  id: "a1111111-1111-4111-8111-111111111111",
  receiptReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  reviewKind: "independent_source_receipt_comparison",
  outcomeKind: "source_metadata_unverified",
  nextDueAt: "2026-11-06",
  evidenceReference: "np-build142-independent-index",
  reviewNote: "Independently witnessed QL-245 receipts are still pending.",
};

test("Build 142 enforces ordered independent phases and safe follow-up", () => {
  assert.equal(
    normalizeQl245SourcePinHoldReview(source, now).nextDueAt,
    "2026-11-06T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...source,
          reviewKind: "trusted_pin_provenance_followup",
          outcomeKind: "pin_not_provisioned",
        },
        now,
      ),
    /Begin with independent/,
  );
  assert.equal(
    normalizeQl245SourcePinHoldReview(
      {
        ...source,
        priorReviewId: source.id,
        reviewKind: "trusted_pin_provenance_followup",
        outcomeKind: "pin_not_provisioned",
      },
      now,
    ).publicSourcePinSha256,
    null,
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...source,
          outcomeKind: "owner_pilot_authorized",
        },
        now,
      ),
    /Unknown QL-245/,
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...source,
          nextDueAt: "2027-04-01",
        },
        now,
      ),
    /within 90 days/,
  );
  assert.equal(
    classifyQl245SourcePinHoldStatus(
      {
        review_kind: "trusted_pin_provenance_followup",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "source_pin_hold_overdue_30_plus",
  );
  assert.equal(
    classifyQl245SourcePinHoldStatus(source, { id: source.id }, now),
    "subsequent_independent_source_pin_hold_review_recorded",
  );
});

test("Build 142 separates syntax checks from independent signer trust", () => {
  const revision = "a".repeat(40);
  const ciUrl =
    "https://github.com/RosevearCreations/iCamp/actions/runs/123456";
  const pin = "b".repeat(64);
  assert.equal(
    normalizeQl245SourcePinHoldReview(
      {
        ...source,
        outcomeKind: "source_metadata_syntax_aligned",
        comparisonSourceRevision: revision,
        comparisonCiRunUrl: ciUrl,
      },
      now,
    ).comparisonSourceRevision,
    revision,
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...source,
          outcomeKind: "source_metadata_syntax_aligned",
        },
        now,
      ),
    /SHA and CI metadata/,
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...source,
          comparisonSourceRevision: revision,
        },
        now,
      ),
    /together/,
  );
  const pinReview = {
    ...source,
    priorReviewId: source.id,
    reviewKind: "trusted_pin_provenance_followup",
    outcomeKind: "pin_reference_unverified",
    publicSourcePinSha256: pin,
    separatelySourcedPinSha256: pin,
    pinProvenanceRef: "np-separate-channel-ref",
  };
  assert.equal(
    normalizeQl245SourcePinHoldReview(pinReview, now).pinProvenanceRef,
    "np-separate-channel-ref",
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...pinReview,
          separatelySourcedPinSha256: "c".repeat(64),
        },
        now,
      ),
    /two matching public fingerprints/,
  );
  assert.throws(
    () =>
      normalizeQl245SourcePinHoldReview(
        {
          ...pinReview,
          outcomeKind: "pin_not_provisioned",
        },
        now,
      ),
    /Do not invent/,
  );
});

test("QL-246 canonical Ed25519 assessment is offline and always leaves gateway HOLD", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const fingerprint = createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  const issue = now.getTime() - 1000;
  const values = {
    schema_version: "rosevear.integration.v1",
    source_system: "icamp",
    repository: "RosevearCreations/iCamp",
    source_revision: "a".repeat(40),
    challenge_id: "np-private-challenge",
    challenge_sha256: "d".repeat(64),
    business_id: "icamp",
    tenant_id: "np-icamp-tenant",
    environment: "nonproduction",
    ci_run_url:
      "https://github.com/RosevearCreations/iCamp/actions/runs/123456",
    allowed_methods: ["GET"],
    allowed_paths: [
      "/api/integration/v1/health",
      "/api/integration/v1/capabilities",
    ],
    negative_tests: Object.fromEntries(
      QL246_NEGATIVE_TESTS.map((key) => [key, true]),
    ),
    gateway_audit_receipt_id: null,
    health_receipt_id: null,
    capabilities_receipt_id: null,
    registered_key_id: null,
    owner_authorization: "NOT_GIVEN",
    connection_state: "DISCONNECTED",
    external_gateway_get_verified: false,
    durable_audit_verified: false,
    owner_identity_verified: false,
    issued_at: issue,
    expires_at: issue + 300000,
  };
  const payload = Object.fromEntries(
    QL246_FIELDS.map((key) => [key, values[key]]),
  );
  const signature = sign(
    null,
    canonicalQl246Payload(payload),
    privateKey,
  ).toString("base64url");
  const data = Buffer.from(
    JSON.stringify({ publicKeyPem: pem, payload, signature }),
  );
  const trusted = {
    sourceRevision: payload.source_revision,
    tenantId: payload.tenant_id,
    challengeId: payload.challenge_id,
    challengeSha256: payload.challenge_sha256,
    ciRunUrl: payload.ci_run_url,
    outOfBandPublicSpkiSha256: fingerprint,
    sevenDenialsIndependentlyWitnessed: true,
  };
  const checked = assessQl246SourceProof(data, trusted, now.getTime());
  assert.equal(checked.status, "SOURCE_METADATA_MATCHED_GATEWAY_HOLD");
  assert.equal(checked.connectionState, "DISCONNECTED");
  assert.equal(checked.gateState, "HOLD");
  assert.equal(
    assessQl246SourceProof(
      data,
      { ...trusted, outOfBandPublicSpkiSha256: "f".repeat(64) },
      now.getTime(),
    ).status,
    "PENDING_BLOCKED",
  );
  assert.equal(
    assessQl246SourceProof(
      data,
      { ...trusted, sevenDenialsIndependentlyWitnessed: false },
      now.getTime(),
    ).status,
    "PENDING_BLOCKED",
  );
  assert.equal(
    assessQl246SourceProof(Buffer.from("{}"), trusted, now.getTime()).status,
    "PENDING_BLOCKED",
  );
  assert.throws(
    () => canonicalQl246Payload({ ...payload, unknown: true }),
    /24 canonical/,
  );
  const tampered = { ...payload, connection_state: "CONNECTED" };
  const altered = Buffer.from(
    JSON.stringify({ publicKeyPem: pem, payload: tampered, signature }),
  );
  const result = assessQl246SourceProof(altered, trusted, now.getTime());
  assert.equal(result.status, "PENDING_BLOCKED");
  assert.ok(result.issues.some((issue) => /signature/.test(issue)));
});

test("Build 142 SQL, owner UI and guarded write path remain immutable and disconnected", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const sql = read(
    "../database/migrations/0172_ql245_source_pin_provenance_gateway_hold.sql",
  );
  for (const phrase of [
    "force row level security",
    "for insert to icamp_app with check",
    "ql245_source_pin_hold_immutable",
    "source_signature_verified=false",
    "independently_trusted_pin_verified=false",
    "new.connection_state:='DISCONNECTED'",
    "new.gate_state:='HOLD'",
    "reviewed_by_user_id=new.reviewed_by_user_id",
    "owner_safe_receipt_verification_queue",
    "observed_overdue_141_leaves",
  ])
    assert.ok(sql.includes(phrase), `Missing Build 142 gate: ${phrase}`);
  const ledger = read(
    "../lib/permanent-unit-owner-retention/recurrence-postgres.mjs",
  );
  assert.ok(ledger.includes("recordQl245SourcePinHoldReview"));
  assert.ok(ledger.includes("sourcePinHoldReviews"));
  const path =
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/";
  assert.ok(read(path + "page.tsx").includes("Build 142"));
  assert.ok(
    read(path + "actions.ts").includes("recordQl245SourcePinHoldReviewAction"),
  );
});
