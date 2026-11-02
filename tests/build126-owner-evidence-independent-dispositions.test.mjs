import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerEvidenceIndependentDisposition,
  classifyOwnerEvidenceRenewalDisposition,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  ownerOutcomeId: "e6666666-6666-4666-8666-666666666666",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  dispositionKind: "escalate_renewal_exception",
  nextDueAt: "2026-11-12",
  evidenceReference: "Independent evidence renewal receipt 126",
  dispositionNote:
    "Renew the escalation and send the evidence back for owner follow-up.",
};

test("Build 126 validates independent disposition, campground pair and UTC aging dates", () => {
  assert.equal(
    normalizeOwnerEvidenceIndependentDisposition(input, now).nextDueAt,
    "2026-11-12T23:59:00.000Z",
  );
  for (const dispositionKind of ["release_hold", "make_payment", ""]) {
    assert.throws(
      () =>
        normalizeOwnerEvidenceIndependentDisposition(
          { ...input, dispositionKind },
          now,
        ),
      /Unknown independent owner evidence disposition/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () =>
        normalizeOwnerEvidenceIndependentDisposition(
          { ...input, nextDueAt },
          now,
        ),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeOwnerEvidenceIndependentDisposition(
        { ...input, dispositionKind: "verify_closure_continuity" },
        now,
      ),
    /cannot schedule an open follow-up/,
  );
  assert.equal(
    normalizeOwnerEvidenceIndependentDisposition(
      {
        ...input,
        dispositionKind: "verify_closure_continuity",
        nextDueAt: "",
      },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeOwnerEvidenceIndependentDisposition(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 126 classifies independent evidence renewal aging and verified closure", () => {
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      { outcome_kind: "acknowledge_independent_closeout" },
      null,
      now,
    ),
    "independent_closure_continuity_review_pending",
  );
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      { outcome_kind: "renew_escalation_exception", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "owner_evidence_renewal_overdue_30_plus",
  );
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      { outcome_kind: "submit_refreshed_evidence", next_due_at: "2026-10-25" },
      null,
      now,
    ),
    "owner_evidence_renewal_overdue",
  );
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      { outcome_kind: "renew_escalation_exception", next_due_at: "2026-11-12" },
      null,
      now,
    ),
    "independent_escalation_disposition_pending",
  );
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      {},
      { disposition_kind: "request_owner_evidence_renewal" },
      now,
    ),
    "owner_evidence_renewal_requested",
  );
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      {},
      { disposition_kind: "escalate_renewal_exception" },
      now,
    ),
    "independent_escalation_disposition_recorded",
  );
  assert.equal(
    classifyOwnerEvidenceRenewalDisposition(
      {},
      { disposition_kind: "verify_closure_continuity" },
      now,
    ),
    "independent_closure_continuity_verified",
  );
});

test("Build 126 database prevents self-review, passive escalation and premature closeout", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0156_owner_evidence_independent_dispositions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "owner_outcome_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "new.reviewed_by_user_id=outcome_record.recorded_by_user_id",
    "observed_owner_days_overdue",
    "observed_peer_pending_outcomes",
    "observed_peer_overdue_outcomes",
    "observed_recent_owner_renewals",
    "observed_recent_independent_escalations",
    "outcome_record.outcome_kind='renew_escalation_exception'",
    "new.observed_owner_days_overdue>=30",
    "new.observed_peer_overdue_outcomes>0",
    "new.observed_recent_owner_renewals>=2",
    "verify_closure_continuity",
    "closeout_record.review_kind<>'independent_exception_closed'",
    "interval '90 days'",
  ]) {
    assert.ok(
      sql.includes(invariant),
      `Missing Build 126 invariant: ${invariant}`,
    );
  }
  assert.ok(
    !/update public\.owner_export_independent_closeout_owner_outcomes/i.test(
      sql,
    ),
  );
});

test("Build 126 private owner ledger links independent actions, aging and audit snapshots", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordOwnerEvidenceIndependentDispositionAction/);
  assert.match(page, /independent_disposition_status/);
  assert.match(page, /observed_peer_pending_outcomes/);
  assert.match(page, /observed_recent_independent_escalations/);
});
