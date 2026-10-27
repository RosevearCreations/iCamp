import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeIndependentCloseoutOwnerOutcome,
  classifyIndependentCloseoutOutcomeAging,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  closeoutReviewId: "e6666666-6666-4666-8666-666666666666",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  outcomeKind: "renew_escalation_exception",
  nextDueAt: "2026-11-12",
  evidenceReference: "Owner exception renewal evidence 125",
  outcomeNote:
    "Renew the escalation exception and schedule another independent evidence review.",
};

test("Build 125 validates owner closeout outcomes, ordered pairs and UTC due dates", () => {
  assert.equal(
    normalizeIndependentCloseoutOwnerOutcome(input, now).nextDueAt,
    "2026-11-12T23:59:00.000Z",
  );
  for (const outcomeKind of ["release_hold", "settle_payment", ""]) {
    assert.throws(
      () =>
        normalizeIndependentCloseoutOwnerOutcome(
          { ...input, outcomeKind },
          now,
        ),
      /Unknown owner evidence outcome/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () =>
        normalizeIndependentCloseoutOwnerOutcome({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeIndependentCloseoutOwnerOutcome(
        { ...input, outcomeKind: "acknowledge_independent_closeout" },
        now,
      ),
    /no open follow-up date/,
  );
  assert.equal(
    normalizeIndependentCloseoutOwnerOutcome(
      {
        ...input,
        outcomeKind: "acknowledge_independent_closeout",
        nextDueAt: "",
      },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeIndependentCloseoutOwnerOutcome(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 125 identifies aging, escalation renewal and owner evidence reconciliation", () => {
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      { review_kind: "independent_exception_closed" },
      null,
      now,
    ),
    "awaiting_owner_evidence_closeout_acknowledgment",
  );
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      {
        review_kind: "request_escalation_evidence_refresh",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "independent_closeout_followup_overdue_30_plus",
  );
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      { review_kind: "continue_exception", next_due_at: "2026-10-25" },
      null,
      now,
    ),
    "independent_closeout_followup_overdue",
  );
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      { review_kind: "manual_escalation", next_due_at: "2026-11-12" },
      null,
      now,
    ),
    "owner_escalation_renewal_pending",
  );
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      {},
      { outcome_kind: "renew_escalation_exception" },
      now,
    ),
    "owner_escalation_exception_renewed",
  );
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      {},
      { outcome_kind: "submit_refreshed_evidence" },
      now,
    ),
    "refreshed_owner_evidence_submitted",
  );
  assert.equal(
    classifyIndependentCloseoutOutcomeAging(
      {},
      { outcome_kind: "acknowledge_independent_closeout" },
      now,
    ),
    "owner_closeout_acknowledged",
  );
});

test("Build 125 SQL enforces immutable owner outcomes, recurrence renewal and RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0155_independent_closeout_owner_evidence_outcomes.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "closeout_review_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "recorded_by_user_id=review_record.reviewed_by_user_id",
    "observed_review_days_overdue",
    "observed_peer_open_reviews",
    "observed_peer_overdue_reviews",
    "observed_prior_independent_escalations",
    "observed_prior_exception_renewals",
    "observed_review_days_overdue>=30",
    "observed_prior_exception_renewals>=2",
    "review_record.review_kind='manual_escalation'",
    "acknowledge_independent_closeout",
    "renew_escalation_exception",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing Build 125 invariant: ${invariant}`,
    );
  assert.ok(
    !/update public\.owner_export_signoff_independent_closeout_reviews/i.test(
      sql,
    ),
  );
});

test("Build 125 private owner UI exposes follow-up aging and evidence-outcome audit", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordIndependentCloseoutOwnerOutcomeAction/);
  assert.match(page, /owner_outcome_status/);
  assert.match(page, /observed_prior_exception_renewals/);
  assert.match(page, /observed_peer_overdue_reviews/);
});
