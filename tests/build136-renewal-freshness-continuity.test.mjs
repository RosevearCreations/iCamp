import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeRenewalFreshnessDecision,
  classifyRenewalFreshnessDecisionStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const input = {
  id,
  ownerRenewalId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  auditKind: "independent_renewal_freshness_comparison",
  outcomeKind: "freshness_stale",
  nextDueAt: "2026-11-15",
  evidenceReference: "Owner renewal source comparison evidence",
  auditNote:
    "Independent comparison found no newer verified source proof for the root.",
};

test("Build 136 validates first independent comparison, two-campground scope and due dates", () => {
  assert.equal(
    normalizeRenewalFreshnessDecision(input, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeRenewalFreshnessDecision(
        {
          ...input,
          auditKind: "owner_continuity_decision_audit",
          outcomeKind: "owner_evidence_renewal_due",
        },
        now,
      ),
    /require a prior independent comparison/,
  );
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-01"]) {
    assert.throws(
      () => normalizeRenewalFreshnessDecision({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeRenewalFreshnessDecision(
        {
          ...input,
          targetCampgroundId: input.sourceCampgroundId,
        },
        now,
      ),
    /different campgrounds/,
  );
  assert.throws(
    () =>
      normalizeRenewalFreshnessDecision(
        { ...input, outcomeKind: "release_hold" },
        now,
      ),
    /Invalid independent renewal freshness/,
  );
});

test("Build 136 only verified fresh comparisons claim new source evidence", () => {
  assert.throws(
    () =>
      normalizeRenewalFreshnessDecision(
        { ...input, outcomeKind: "freshness_verified" },
        now,
      ),
    /needs a new source event/,
  );
  assert.equal(
    normalizeRenewalFreshnessDecision(
      {
        ...input,
        outcomeKind: "freshness_verified",
        comparisonEvidenceEventId: id,
      },
      now,
    ).comparisonEvidenceEventId,
    id,
  );
  assert.throws(
    () =>
      normalizeRenewalFreshnessDecision(
        { ...input, comparisonEvidenceEventId: id },
        now,
      ),
    /cannot claim one/,
  );
  const owner = {
    ...input,
    priorAuditId: id,
    auditKind: "owner_continuity_decision_audit",
    outcomeKind: "owner_continuity_confirmed",
  };
  assert.equal(
    normalizeRenewalFreshnessDecision(owner, now).comparisonEvidenceEventId,
    null,
  );
});

test("Build 136 recurrence and owner statuses expose late and independently reassessed records", () => {
  assert.equal(
    classifyRenewalFreshnessDecisionStatus(
      { next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "renewal_continuity_overdue_30_plus",
  );
  assert.equal(
    classifyRenewalFreshnessDecisionStatus(
      { next_due_at: "2026-10-26" },
      null,
      now,
    ),
    "renewal_continuity_overdue",
  );
  assert.equal(
    classifyRenewalFreshnessDecisionStatus(
      {
        audit_kind: "reopening_watch_exception_reassessment",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "reopening_exception_reassessment_pending",
  );
  assert.equal(
    classifyRenewalFreshnessDecisionStatus(
      {
        audit_kind: "owner_continuity_decision_audit",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "owner_continuity_decision_pending",
  );
  assert.equal(
    classifyRenewalFreshnessDecisionStatus({}, { id }, now),
    "subsequent_freshness_or_continuity_audit_recorded",
  );
});

test("Build 136 database guard prevents recycled proof, false clearance and tenant leakage", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0166_renewal_freshness_watch_continuity_audit.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "owner_renewal_id uuid not null references",
    "prior_audit_id uuid unique references",
    "comparison_evidence_event_id uuid unique references",
    "renewal_freshness_first_audit_idx",
    "owner_renewal.renewal_kind<>'owner_evidence_renewal'",
    "comparison_proof.root_reopen_id=reopened_record.id",
    "comparison_proof.recorded_at>baseline_proof.recorded_at",
    "new.observed_new_reopenings>0",
    "prior_record.outcome_kind<>'watch_no_exception'",
    "new.observed_prior_days_overdue>=30",
    "independent reviewer must differ from preceding evidence reviewer",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing Build 136 guard: ${guard}`);
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 136 UI links independent proof comparison, recheck and owner decision", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const guard of [
    "recordRenewalFreshnessDecisionAction",
    "independent_renewal_freshness_comparison",
    "reopening_watch_exception_reassessment",
    "owner_continuity_decision_audit",
    "comparisonEvidenceEventId",
    "audit_status",
  ])
    assert.ok(page.includes(guard), `Missing Build 136 workflow: ${guard}`);
});
