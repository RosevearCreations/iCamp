import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerProofGatewayReview,
  classifyOwnerProofGatewayReviewStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T20:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const other = "b2222222-2222-4222-8222-222222222222";
const source = {
  id,
  ownerReconciliationId: other,
  sourceCampgroundId: id,
  targetCampgroundId: other,
  reviewKind: "independent_owner_proof_renewal",
  outcomeKind: "renewal_source_drift",
  nextDueAt: "2026-11-07",
  evidenceReference: "build-140-source-reference",
  reviewNote: "Independent recurrence comparison showed source drift.",
};

test("Build 140 requires the first independent proof renewal with a 90-day UTC review", () => {
  assert.equal(
    normalizeOwnerProofGatewayReview(source, now).nextDueAt,
    "2026-11-07T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeOwnerProofGatewayReview(
        {
          ...source,
          reviewKind: "aged_exception_disposition",
          outcomeKind: "aged_exception_overdue",
        },
        now,
      ),
    /Begin with/,
  );
  for (const d of ["2026-10-01", "2027-04-01", "2026-11-31"])
    assert.throws(
      () => normalizeOwnerProofGatewayReview({ ...source, nextDueAt: d }, now),
      /within 90 days/,
    );
  assert.throws(
    () =>
      normalizeOwnerProofGatewayReview(
        { ...source, targetCampgroundId: id },
        now,
      ),
    /different campgrounds/i,
  );
});

test("Build 140 positive renewal demands a newer verified event", () => {
  const current = { ...source, outcomeKind: "renewal_current" };
  assert.throws(
    () => normalizeOwnerProofGatewayReview(current, now),
    /new independently verified/,
  );
  assert.equal(
    normalizeOwnerProofGatewayReview(
      { ...current, verifiedRenewalEventId: id },
      now,
    ).verifiedRenewalEventId,
    id,
  );
  assert.throws(
    () =>
      normalizeOwnerProofGatewayReview(
        { ...source, verifiedRenewalEventId: id },
        now,
      ),
    /new independently verified/,
  );
});

test("Build 140 gateway documentary references are restricted to HOLD stage and never authorize a pilot", () => {
  const gate = {
    ...source,
    priorReviewId: other,
    reviewKind: "cross_system_read_only_gate_review",
    outcomeKind: "gateway_documented_hold",
  };
  assert.throws(
    () => normalizeOwnerProofGatewayReview(gate, now),
    /four non-secret source references/,
  );
  const refs = {
    gatewayHealthReceiptRef: "np-health-123",
    gatewayCapabilitiesReceiptRef: "np-cap-12345",
    gatewayAuditReceiptRef: "np-audit-123",
    independentWitnessAttestationRef: "np-witness-123",
  };
  const v = normalizeOwnerProofGatewayReview({ ...gate, ...refs }, now);
  assert.equal(v.gatewayAuditReceiptRef, "np-audit-123");
  assert.throws(
    () => normalizeOwnerProofGatewayReview({ ...source, ...refs }, now),
    /only on the read-only HOLD/,
  );
  assert.throws(
    () =>
      normalizeOwnerProofGatewayReview(
        {
          ...gate,
          ...refs,
          gatewayHealthReceiptRef: "https://bad.site/?token=secret",
        },
        now,
      ),
    /non-secret receipt ID only/,
  );
  assert.equal(
    normalizeOwnerProofGatewayReview(
      { ...gate, outcomeKind: "gateway_evidence_missing" },
      now,
    ).gatewayAuditReceiptRef,
    null,
  );
});

test("Build 140 distinguishes overdue cases from pending independent outcomes", () => {
  assert.equal(
    classifyOwnerProofGatewayReviewStatus(
      { review_kind: "aged_exception_disposition", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "owner_proof_review_overdue_30_plus",
  );
  assert.equal(
    classifyOwnerProofGatewayReviewStatus(
      { review_kind: "aged_exception_disposition", next_due_at: "2026-10-20" },
      null,
      now,
    ),
    "owner_proof_review_overdue",
  );
  assert.equal(
    classifyOwnerProofGatewayReviewStatus(
      {
        review_kind: "cross_system_read_only_gate_review",
        next_due_at: "2026-11-20",
      },
      null,
      now,
    ),
    "cross_system_read_only_gate_review_held",
  );
  assert.equal(
    classifyOwnerProofGatewayReviewStatus({}, { id }, now),
    "subsequent_owner_proof_review_recorded",
  );
});

test("Build 140 forced RLS, independent source evidence, exception counts and unconditional HOLD", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0170_owner_proof_recurrence_renewal_aged_exception_gateway_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const x of [
    "owner_reconciliation_id uuid not null references public.owner_export_continuity_evidence_reconciliations(id)",
    "new_proof.root_reopen_id=base_proof.root_reopen_id",
    "new_proof.recorded_at>latest_proof_at",
    "new_proof.recorded_by_user_id<>new.reviewed_by_user_id",
    "new.observed_open_139_exceptions>0",
    "new.observed_overdue_139_reviews>0",
    "new.observed_prior_overdue_days>=30",
    "new.reviewed_by_user_id=prior_record.reviewed_by_user_id",
    "gate_state text not null default 'HOLD' check(gate_state='HOLD')",
    "owner_pilot_authorized boolean not null default false check(owner_pilot_authorized=false)",
    "dispatch_enabled boolean not null default false check(dispatch_enabled=false)",
    "force row level security",
    "winterization_append_only",
  ])
    assert.ok(sql.includes(x), `Missing Build 140 audit guard: ${x}`);
});

test("Build 140 owner screen, action and PostgreSQL ledger are connected", () => {
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
  for (const x of [
    "Build 140",
    "ownerProofGatewayQueue",
    "recordOwnerProofGatewayReviewAction",
    "gatewayHealthReceiptRef",
    "independentWitnessAttestationRef",
    "report.ownerProofGatewayReviews",
  ])
    assert.ok(page.includes(x), `Build 140 owner UI missing ${x}`);
  assert.ok(actions.includes("recordOwnerProofGatewayReview({"));
  assert.ok(
    db.includes("insert into public.owner_export_proof_renewal_gate_reviews"),
  );
});
