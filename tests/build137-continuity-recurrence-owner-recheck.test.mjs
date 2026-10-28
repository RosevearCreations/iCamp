import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeContinuityRecurrenceRecheck,
  classifyContinuityRecurrenceRecheckStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const base = {
  id,
  ownerContinuityId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  recheckKind: "independent_continuity_recurrence_watch",
  outcomeKind: "continuity_recurrence_detected",
  nextDueAt: "2026-11-15",
  evidenceReference: "Independent Build 136 owner continuity source receipt",
  recheckNote: "New recurrence watch requires independent source follow-up.",
};

test("Build 137 enforces ordered independent watch and due dates", () => {
  assert.equal(
    normalizeContinuityRecurrenceRecheck(base, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeContinuityRecurrenceRecheck(
        {
          ...base,
          recheckKind: "verified_owner_audit_recheck",
          outcomeKind: "owner_audit_on_hold",
        },
        now,
      ),
    /start with an independent recurrence watch/,
  );
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-01"])
    assert.throws(
      () => normalizeContinuityRecurrenceRecheck({ ...base, nextDueAt }, now),
      /within 90 days/,
    );
  assert.throws(
    () =>
      normalizeContinuityRecurrenceRecheck(
        { ...base, targetCampgroundId: base.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
  assert.throws(
    () =>
      normalizeContinuityRecurrenceRecheck(
        { ...base, outcomeKind: "automatic_hold_release" },
        now,
      ),
    /Invalid independent continuity recurrence/,
  );
});

test("Build 137 prevents positive owner recheck without a distinct source proof", () => {
  const owner = {
    ...base,
    recheckKind: "verified_owner_audit_recheck",
    priorRecheckId: id,
    outcomeKind: "owner_audit_reverified",
  };
  assert.throws(
    () => normalizeContinuityRecurrenceRecheck(owner, now),
    /needs new independently verified proof/,
  );
  assert.equal(
    normalizeContinuityRecurrenceRecheck(
      { ...owner, verifiedFollowupEventId: id },
      now,
    ).verifiedFollowupEventId,
    id,
  );
  assert.throws(
    () =>
      normalizeContinuityRecurrenceRecheck(
        {
          ...owner,
          outcomeKind: "owner_audit_on_hold",
          verifiedFollowupEventId: id,
        },
        now,
      ),
    /open exceptions cannot claim one/,
  );
});

test("Build 137 surfaces overdue renewal and owner recheck continuations", () => {
  assert.equal(
    classifyContinuityRecurrenceRecheckStatus(
      { next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "owner_recheck_overdue_30_plus",
  );
  assert.equal(
    classifyContinuityRecurrenceRecheckStatus(
      { next_due_at: "2026-10-26" },
      null,
      now,
    ),
    "owner_recheck_overdue",
  );
  assert.equal(
    classifyContinuityRecurrenceRecheckStatus(
      {
        recheck_kind: "renewal_exception_followup_aging",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "renewal_exception_aging_followup_pending",
  );
  assert.equal(
    classifyContinuityRecurrenceRecheckStatus(
      {
        recheck_kind: "verified_owner_audit_recheck",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "verified_owner_audit_recheck_pending",
  );
  assert.equal(
    classifyContinuityRecurrenceRecheckStatus({}, { id }, now),
    "subsequent_independent_continuity_recheck_recorded",
  );
});

test("Build 137 database guard is independent, same-root, overdue-aware and append-only", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0167_independent_continuity_recurrence_owner_recheck.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "owner_continuity_id uuid not null references",
    "prior_recheck_id uuid unique references",
    "verified_followup_event_id uuid unique references",
    "continuity_recheck_first_watch_idx",
    "owner_record.audit_kind<>'owner_continuity_decision_audit'",
    "baseline_proof.root_reopen_id<>baseline_reopen.id",
    "verified_event.root_reopen_id=baseline_reopen.id",
    "verified_event.recorded_at>latest_proof_at",
    "new.observed_new_reopenings>0",
    "new.observed_open_renewal_exceptions>0",
    "new.observed_overdue_renewal_reviews>0",
    "new.observed_prior_days_overdue>=30",
    "independent reviewer must differ from preceding recheck reviewer",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(guard),
      `Missing Build 137 source/permission safeguard: ${guard}`,
    );
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 137 owner UI contains queue, source proof selection and immutable history", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const label of [
    "recordContinuityRecurrenceRecheckAction",
    "independent_continuity_recurrence_watch",
    "renewal_exception_followup_aging",
    "verified_owner_audit_recheck",
    "verifiedFollowupEventId",
    "recheck_status",
  ])
    assert.ok(page.includes(label), `Build 137 UI missing ${label}`);
});
