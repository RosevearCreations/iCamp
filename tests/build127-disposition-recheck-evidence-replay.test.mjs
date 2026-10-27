import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeIndependentDispositionRecheck,
  classifyIndependentDispositionRecheckAging,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  independentDispositionId: "e6666666-6666-4666-8666-666666666666",
  replayOwnerOutcomeId: "c7777777-7777-4777-8777-777777777777",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  recheckKind: "renew_escalation_recheck",
  nextDueAt: "2026-11-14",
  evidenceReference: "Owner evidence replay receipt 127",
  recheckNote:
    "Reconcile the linked evidence renewal and retain explicit escalation.",
};

test("Build 127 validates recheck outcomes, source identity and UTC follow-up", () => {
  assert.equal(
    normalizeIndependentDispositionRecheck(input, now).nextDueAt,
    "2026-11-14T23:59:00.000Z",
  );
  for (const recheckKind of ["release_hold", "issue_payment", ""]) {
    assert.throws(
      () =>
        normalizeIndependentDispositionRecheck({ ...input, recheckKind }, now),
      /Unknown independent escalation disposition recheck/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () =>
        normalizeIndependentDispositionRecheck({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeIndependentDispositionRecheck(
        { ...input, recheckKind: "confirm_closure_continuity_recheck" },
        now,
      ),
    /no open follow-up date/,
  );
  assert.equal(
    normalizeIndependentDispositionRecheck(
      {
        ...input,
        recheckKind: "confirm_closure_continuity_recheck",
        nextDueAt: "",
      },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeIndependentDispositionRecheck(
        { ...input, replayOwnerOutcomeId: "invalid" },
        now,
      ),
    /replayed owner evidence outcome/,
  );
  assert.throws(
    () =>
      normalizeIndependentDispositionRecheck(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 127 classifies aging, escalation replay and closure continuity recheck", () => {
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      { disposition_kind: "verify_closure_continuity" },
      null,
      now,
    ),
    "independent_closure_continuity_recheck_pending",
  );
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      {
        disposition_kind: "escalate_renewal_exception",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "independent_disposition_recheck_overdue_30_plus",
  );
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      {
        disposition_kind: "request_owner_evidence_renewal",
        next_due_at: "2026-10-25",
      },
      null,
      now,
    ),
    "independent_disposition_recheck_overdue",
  );
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      {
        disposition_kind: "escalate_renewal_exception",
        next_due_at: "2026-11-14",
      },
      null,
      now,
    ),
    "independent_escalation_recheck_pending",
  );
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      {},
      { recheck_kind: "renew_escalation_recheck" },
      now,
    ),
    "independent_escalation_recheck_renewed",
  );
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      {},
      { recheck_kind: "request_owner_renewal_replay" },
      now,
    ),
    "owner_evidence_replay_requested",
  );
  assert.equal(
    classifyIndependentDispositionRecheckAging(
      {},
      { recheck_kind: "confirm_closure_continuity_recheck" },
      now,
    ),
    "independent_closure_continuity_reconfirmed",
  );
});

test("Build 127 PostgreSQL recheck safeguards block forged replay and silent closeout", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0157_independent_escalation_disposition_rechecks.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "independent_disposition_id uuid not null unique",
    "replay_owner_outcome_id uuid not null",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "new.reviewed_by_user_id=disposition_record.reviewed_by_user_id",
    "new.reviewed_by_user_id=source_owner.recorded_by_user_id",
    "new.reviewed_by_user_id=replay_owner.recorded_by_user_id",
    "new.observed_replay_is_newer:=replay_owner.id<>source_owner.id",
    "replay_owner.recorded_at<=source_owner.recorded_at",
    "observed_disposition_days_overdue",
    "observed_peer_pending_dispositions",
    "observed_peer_overdue_dispositions",
    "observed_recent_escalation_rechecks",
    "observed_recent_owner_renewals",
    "new.observed_disposition_days_overdue>=30",
    "disposition_record.disposition_kind='escalate_renewal_exception'",
    "confirm_closure_continuity_recheck",
    "new.replay_owner_outcome_id<>source_owner.id",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing Build 127 safeguard: ${invariant}`,
    );
  assert.ok(
    !/update public\.owner_export_owner_evidence_independent_dispositions/i.test(
      sql,
    ),
  );
});

test("Build 127 private owner UI preserves source-linked replay and independent snapshots", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const key of [
    "recordIndependentDispositionRecheckAction",
    "independent_recheck_status",
    "replayOwnerOutcomeId",
    "observed_replay_is_newer",
    "observed_peer_overdue_dispositions",
    "observed_recent_owner_renewals",
  ])
    assert.ok(page.includes(key), `Missing Build 127 UI evidence ${key}`);
});
