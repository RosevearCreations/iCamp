import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerSignoffIndependentCloseout,
  classifyOwnerSignoffFollowup,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  ownerSignoffId: "e6666666-6666-4666-8666-666666666666",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  reviewKind: "request_escalation_evidence_refresh",
  nextDueAt: "2026-11-12",
  evidenceReference: "Independent escalation follow-up evidence 124",
  reviewNote:
    "Collect updated escalation evidence before the next independent review.",
};

test("Build 124 validates independent owner follow-up dates and closeout kind", () => {
  assert.equal(
    normalizeOwnerSignoffIndependentCloseout(input, now).nextDueAt,
    "2026-11-12T23:59:00.000Z",
  );
  for (const reviewKind of ["release_hold", "approve_transfer", ""]) {
    assert.throws(
      () =>
        normalizeOwnerSignoffIndependentCloseout({ ...input, reviewKind }, now),
      /Unknown independent owner sign-off/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () =>
        normalizeOwnerSignoffIndependentCloseout({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeOwnerSignoffIndependentCloseout(
        { ...input, reviewKind: "independent_exception_closed" },
        now,
      ),
    /cannot schedule an open review/,
  );
  assert.equal(
    normalizeOwnerSignoffIndependentCloseout(
      { ...input, reviewKind: "independent_exception_closed", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeOwnerSignoffIndependentCloseout(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 124 labels overdue owner follow-ups and independent evidence findings", () => {
  assert.equal(
    classifyOwnerSignoffFollowup(
      { signoff_kind: "acknowledge_independent_closure" },
      null,
      now,
    ),
    "awaiting_independent_closeout",
  );
  assert.equal(
    classifyOwnerSignoffFollowup(
      { signoff_kind: "request_evidence_refresh", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "owner_signoff_followup_overdue_30_plus",
  );
  assert.equal(
    classifyOwnerSignoffFollowup(
      { signoff_kind: "owner_exception_signed_off", next_due_at: "2026-10-25" },
      null,
      now,
    ),
    "owner_signoff_followup_overdue",
  );
  assert.equal(
    classifyOwnerSignoffFollowup(
      { signoff_kind: "accept_manual_escalation", next_due_at: "2026-11-12" },
      null,
      now,
    ),
    "escalation_evidence_followup_pending",
  );
  assert.equal(
    classifyOwnerSignoffFollowup({}, { review_kind: "manual_escalation" }, now),
    "independently_escalated_again",
  );
  assert.equal(
    classifyOwnerSignoffFollowup(
      {},
      { review_kind: "request_escalation_evidence_refresh" },
      now,
    ),
    "escalation_evidence_refresh_requested",
  );
  assert.equal(
    classifyOwnerSignoffFollowup(
      {},
      { review_kind: "independent_exception_closed" },
      now,
    ),
    "independent_exception_closed",
  );
});

test("Build 124 SQL enforces independently reviewed closure and recurrence snapshots", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0154_owner_signoff_independent_exception_closeout.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "owner_signoff_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "reviewed_by_user_id=signoff_record.signed_by_user_id",
    "reviewed_by_user_id=audit_record.audited_by_user_id",
    "observed_signoff_days_overdue",
    "observed_peer_open_signoffs",
    "observed_peer_overdue_signoffs",
    "observed_prior_escalation_acceptances",
    "observed_prior_evidence_refreshes",
    "observed_signoff_days_overdue>=30",
    "observed_prior_escalation_acceptances>=2",
    "signoff_record.signoff_kind<>'acknowledge_independent_closure'",
    "audit_record.audit_kind<>'independent_audit_closed'",
    "request_escalation_evidence_refresh",
    "independent_exception_closed",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing Build 124 invariant: ${invariant}`,
    );
  assert.ok(
    !/update public\.owner_export_closure_audit_owner_signoffs/i.test(sql),
  );
});

test("Build 124 UI exposes aging, independent closeout, and evidence refresh", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordOwnerSignoffIndependentCloseoutAction/);
  assert.match(page, /independent_closeout_status/);
  assert.match(page, /observed_prior_evidence_refreshes/);
  assert.match(page, /observed_peer_overdue_signoffs/);
});
