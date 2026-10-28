import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeGatewayHoldReceiptReview,
  classifyGatewayHoldReceiptReviewStatus,
  gatewayHoldReceiptKinds,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-28T12:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const other = "b2222222-2222-4222-8222-222222222222";
const source = {
  id,
  gatewayReviewId: other,
  sourceCampgroundId: id,
  targetCampgroundId: other,
  reviewKind: "independent_gateway_hold_freshness_review",
  outcomeKind: "hold_evidence_unverified",
  nextDueAt: "2026-11-05",
  evidenceReference: "np-141-owner-followup-index",
  reviewNote:
    "Original cross-system nonproduction receipts were not independently provided.",
};

test("Build 141 requires owner-independent first HOLD freshness review and an honest UTC follow-up", () => {
  assert.equal(
    normalizeGatewayHoldReceiptReview(source, now).nextDueAt,
    "2026-11-05T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        {
          ...source,
          reviewKind: "aged_exception_recurrence_watch",
          outcomeKind: "exception_recurrence_escalated",
        },
        now,
      ),
    /Begin with independent/,
  );
  for (const due of ["2026-10-01", "2027-04-01", "2026-11-31"])
    assert.throws(
      () =>
        normalizeGatewayHoldReceiptReview({ ...source, nextDueAt: due }, now),
      /within 90 days/,
    );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...source, targetCampgroundId: id },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 141 differentiates overdue recurrence from ordinary watch and rejects unsupported outcomes", () => {
  const priorReviewId = other;
  assert.equal(
    normalizeGatewayHoldReceiptReview(
      {
        ...source,
        priorReviewId,
        reviewKind: "aged_exception_recurrence_watch",
        outcomeKind: "no_new_exception_observed",
      },
      now,
    ).outcomeKind,
    "no_new_exception_observed",
  );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...source, outcomeKind: "owner_pilot_authorized" },
        now,
      ),
    /Unknown independent gateway HOLD/,
  );
  assert.equal(
    classifyGatewayHoldReceiptReviewStatus(
      {
        review_kind: "aged_exception_recurrence_watch",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "gateway_hold_followup_overdue_30_plus",
  );
  assert.equal(
    classifyGatewayHoldReceiptReviewStatus(
      {
        review_kind: "independent_gateway_hold_freshness_review",
        next_due_at: "2026-11-20",
      },
      null,
      now,
    ),
    "gateway_hold_freshness_pending",
  );
  assert.equal(
    classifyGatewayHoldReceiptReviewStatus(
      {
        review_kind: "owner_safe_receipt_verification_queue",
        next_due_at: "2026-10-20",
      },
      null,
      now,
    ),
    "gateway_hold_followup_overdue",
  );
  assert.equal(
    classifyGatewayHoldReceiptReviewStatus({}, { id }, now),
    "independent_gateway_hold_followup_recorded",
  );
});

test("QL-245 allows precisely two GET scopes and queues all seven real denial categories without pretending to execute them", () => {
  for (const kind of [
    "denial_nonce_replay",
    "denial_stale_request",
    "denial_wrong_business",
    "denial_wrong_tenant",
    "denial_revoked_key",
    "denial_prohibited_write",
    "denial_prohibited_dispatch",
  ])
    assert.ok(gatewayHoldReceiptKinds.includes(kind));
  const cfg = readFileSync(
    new URL("../lib/integration-v1/readiness.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(cfg.includes('"/api/integration/v1/health"'));
  assert.ok(cfg.includes('"/api/integration/v1/capabilities"'));
  assert.ok(
    cfg.includes('env.ICAMP_INTEGRATION_V1_ENVIRONMENT === "nonproduction"'),
  );
  assert.ok(cfg.includes('"GET"'));
  const route = readFileSync(
    new URL("../lib/integration-v1/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(route.includes("handleIntegrationMethodDenied"));
});

test("QL-245 queue accepts only nonsecret np- reference IDs or a paired iCamp SHA and Actions run link", () => {
  const queue = {
    ...source,
    priorReviewId: other,
    reviewKind: "owner_safe_receipt_verification_queue",
    outcomeKind: "receipt_missing",
    receiptKind: "denial_nonce_replay",
  };
  assert.equal(
    normalizeGatewayHoldReceiptReview(queue, now).receiptReference,
    null,
  );
  assert.equal(
    normalizeGatewayHoldReceiptReview(
      { ...queue, outcomeKind: "receipt_not_provisioned" },
      now,
    ).receiptKind,
    "denial_nonce_replay",
  );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...queue, outcomeKind: "receipt_reference_unverified" },
        now,
      ),
    /requires actual nonsecret evidence/,
  );
  assert.equal(
    normalizeGatewayHoldReceiptReview(
      {
        ...queue,
        outcomeKind: "receipt_reference_unverified",
        receiptReference: "np-actual-id-123",
      },
      now,
    ).receiptReference,
    "np-actual-id-123",
  );
  for (const reference of [
    "secret12345",
    "https://example.test/token",
    "np-abc@personal.test",
    `np-${"a".repeat(158)}`,
  ])
    assert.throws(
      () =>
        normalizeGatewayHoldReceiptReview(
          {
            ...queue,
            outcomeKind: "receipt_reference_unverified",
            receiptReference: reference,
          },
          now,
        ),
      /non-secret receipt ID|begin with np-/,
    );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...queue, receiptReference: "np-not-actually-provisioned" },
        now,
      ),
    /cannot include invented receipts/,
  );
  const ci = {
    ...queue,
    receiptKind: "source_ci_revision",
    outcomeKind: "receipt_reference_unverified",
    sourceRevision: "a".repeat(40),
    ciRunUrl: "https://github.com/RosevearCreations/iCamp/actions/runs/1234567",
  };
  assert.equal(
    normalizeGatewayHoldReceiptReview(ci, now).sourceRevision,
    "a".repeat(40),
  );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...ci, ciRunUrl: "https://github.com/another/repo/actions/runs/123" },
        now,
      ),
    /genuine GitHub Actions/,
  );
  assert.throws(
    () => normalizeGatewayHoldReceiptReview({ ...ci, sourceRevision: "" }, now),
    /together/,
  );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...ci, receiptKind: "denial_nonce_replay" },
        now,
      ),
    /correct receipt queue item/,
  );
  assert.throws(
    () =>
      normalizeGatewayHoldReceiptReview(
        { ...source, receiptReference: "np-unexpected-12345" },
        now,
      ),
    /only to the correct receipt queue/,
  );
});

test("Build 141 migration ensures immutable scoped receipt queue with fail-closed HOLD and no credential table", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0171_gateway_hold_freshness_exception_receipt_queue.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fragment of [
    "owner_export_proof_renewal_gate_reviews(id)",
    "base.review_kind<>'cross_system_read_only_gate_review'",
    "prior_record.reviewed_by_user_id=new.reviewed_by_user_id",
    "observed_open_140_exceptions",
    "observed_overdue_140_leaves",
    "observed_newer_gateway_reviews",
    "new.observed_open_140_exceptions>0",
    "next_due_at>new.reviewed_at+interval '90 days'",
    "connection_state text not null default 'DISCONNECTED' check(connection_state='DISCONNECTED')",
    "gate_state text not null default 'HOLD' check(gate_state='HOLD')",
    "receipt_proof_state text not null default 'UNVERIFIED' check(receipt_proof_state='UNVERIFIED')",
    "owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false)",
    "dispatch_enabled boolean not null default false check(dispatch_enabled=false)",
    "force row level security",
    "winterization_append_only",
    "to icamp_app with check",
  ])
    assert.ok(
      sql.includes(fragment),
      `Missing Build 141 protection: ${fragment}`,
    );
  assert.ok(!sql.includes("create table public.integration_credentials"));
});

test("Build 141 read-only evidence queue is wired to owner ledger and a guarded server action", () => {
  const dir =
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/";
  const page = readFileSync(new URL(`${dir}page.tsx`, import.meta.url), "utf8");
  const actions = readFileSync(
    new URL(`${dir}actions.ts`, import.meta.url),
    "utf8",
  );
  const db = readFileSync(
    new URL(
      "../lib/permanent-unit-owner-retention/recurrence-postgres.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  for (const word of [
    "Build 141",
    "gatewayHoldReceiptQueue",
    "gatewayHoldReceiptKinds",
    "QL-245",
    "report.gatewayHoldReceiptReviews",
    "recordGatewayHoldReceiptReviewAction",
  ])
    assert.ok(page.includes(word), `Missing owner queue ${word}`);
  assert.ok(actions.includes("await recordGatewayHoldReceiptReview({"));
  assert.ok(
    db.includes("insert into public.owner_export_gateway_hold_receipt_reviews"),
  );
});
