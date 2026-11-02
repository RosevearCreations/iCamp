import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeContinuityEvidenceReconciliation,
  classifyContinuityEvidenceReconciliationStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T20:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const other = "b2222222-2222-4222-8222-222222222222";
const base = {
  id,
  continuityWatchId: other,
  sourceCampgroundId: id,
  targetCampgroundId: other,
  reviewKind: "independent_continuity_evidence_recurrence_review",
  outcomeKind: "recurrence_drift",
  nextDueAt: "2026-11-01",
  evidenceReference: "source-watch-139",
  reviewNote: "Independent source comparison shows drift.",
};

test("Build 139 starts with recurrence review and requires UTC due within 90 days", () => {
  assert.equal(
    normalizeContinuityEvidenceReconciliation(base, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeContinuityEvidenceReconciliation(
        {
          ...base,
          reviewKind: "aging_exception_followup",
          outcomeKind: "aging_exception_overdue",
        },
        now,
      ),
    /come first/,
  );
  for (const date of ["2026-10-20", "2027-03-01", "2026-11-31"])
    assert.throws(
      () =>
        normalizeContinuityEvidenceReconciliation(
          { ...base, nextDueAt: date },
          now,
        ),
      /within 90 days/,
    );
  assert.throws(
    () =>
      normalizeContinuityEvidenceReconciliation(
        { ...base, sourceCampgroundId: other },
        now,
      ),
    /different campgrounds/i,
  );
});

test("Build 139 owner reconciliation requires explicit verified source event", () => {
  const owner = {
    ...base,
    priorReconciliationId: other,
    reviewKind: "owner_audit_proof_reconciliation",
    outcomeKind: "owner_proof_reconciled",
  };
  assert.throws(
    () => normalizeContinuityEvidenceReconciliation(owner, now),
    /new verified source/,
  );
  assert.equal(
    normalizeContinuityEvidenceReconciliation(
      { ...owner, verifiedSourceEventId: id },
      now,
    ).verifiedSourceEventId,
    id,
  );
  assert.throws(
    () =>
      normalizeContinuityEvidenceReconciliation(
        { ...owner, outcomeKind: "owner_proof_gap", verifiedSourceEventId: id },
        now,
      ),
    /new verified source/,
  );
});

test("Build 139 separates aging states and subsequent independent reviews", () => {
  assert.equal(
    classifyContinuityEvidenceReconciliationStatus(
      { review_kind: "aging_exception_followup", next_due_at: "2026-10-01" },
      null,
      now,
    ),
    "evidence_reconciliation_overdue",
  );
  assert.equal(
    classifyContinuityEvidenceReconciliationStatus(
      { review_kind: "aging_exception_followup", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "evidence_reconciliation_overdue_30_plus",
  );
  assert.equal(
    classifyContinuityEvidenceReconciliationStatus(
      { review_kind: "aging_exception_followup", next_due_at: "2026-11-01" },
      null,
      now,
    ),
    "aging_exception_followup_pending",
  );
  assert.equal(
    classifyContinuityEvidenceReconciliationStatus({}, { id }, now),
    "subsequent_independent_reconciliation_recorded",
  );
});

test("Build 139 database keeps verified same-root evidence, independent reviews, forced RLS, immutable ledger", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0169_continuity_evidence_recurrence_owner_reconciliation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const phrase of [
    "continuity_watch_id uuid not null references public.owner_export_owner_recheck_renewal_watches(id)",
    "watch_kind<>'continuity_evidence_watch'",
    "root_reopen_id=original_proof.root_reopen_id",
    "linked_proof.recorded_by_user_id<>new.reviewed_by_user_id",
    "linked_proof.recorded_at>baseline_at",
    "new.observed_overdue_renewal_watches>0",
    "new.observed_later_reopenings>0",
    "new.observed_prior_overdue_days>=30",
    "new.reviewed_by_user_id=prior_record.reviewed_by_user_id",
    "force row level security",
    "winterization_append_only",
    "create unique index continuity_evidence_reconciliation_first_idx",
  ])
    assert.ok(sql.includes(phrase), `Missing Build 139 guard: ${phrase}`);
});

test("Build 139 owner UI, action and persistence are integrated", () => {
  const baseDir =
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/";
  const page = readFileSync(
    new URL(`${baseDir}page.tsx`, import.meta.url),
    "utf8",
  );
  const actions = readFileSync(
    new URL(`${baseDir}actions.ts`, import.meta.url),
    "utf8",
  );
  const postgres = readFileSync(
    new URL(
      "../lib/permanent-unit-owner-retention/recurrence-postgres.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  for (const text of [
    "Build 139",
    "evidenceReconciliationQueue",
    "recordContinuityEvidenceReconciliationAction",
    "verifiedSourceEventId",
    "report.continuityEvidenceReconciliations",
  ])
    assert.ok(page.includes(text), `UI missing ${text}`);
  assert.ok(actions.includes("recordContinuityEvidenceReconciliation({"));
  assert.ok(
    postgres.includes(
      "insert into public.owner_export_continuity_evidence_reconciliations",
    ),
  );
});
