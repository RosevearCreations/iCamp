import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerRecheckRenewalWatch,
  classifyOwnerRecheckRenewalWatchStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const base = {
  id,
  ownerRecheckId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  watchKind: "independent_owner_recheck_recurrence_renewal",
  outcomeKind: "recurrence_detected",
  nextDueAt: "2026-11-15",
  evidenceReference: "Owner audit recheck source continuity reference",
  watchNote:
    "Independent recheck renewal identified a recurrence to investigate.",
};

test("Build 138 requires a first independent recurrence renewal and valid UTC due date", () => {
  assert.equal(
    normalizeOwnerRecheckRenewalWatch(base, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeOwnerRecheckRenewalWatch(
        {
          ...base,
          watchKind: "overdue_exception_disposition",
          outcomeKind: "exception_escalated",
        },
        now,
      ),
    /begin with independent recurrence review/,
  );
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-01"])
    assert.throws(
      () => normalizeOwnerRecheckRenewalWatch({ ...base, nextDueAt }, now),
      /within 90 days/,
    );
  assert.throws(
    () =>
      normalizeOwnerRecheckRenewalWatch(
        {
          ...base,
          targetCampgroundId: base.sourceCampgroundId,
        },
        now,
      ),
    /different campgrounds/,
  );
  assert.throws(
    () =>
      normalizeOwnerRecheckRenewalWatch(
        {
          ...base,
          outcomeKind: "release_customer_hold",
        },
        now,
      ),
    /Invalid independent owner recheck renewal/,
  );
});

test("Build 138 positive continuity must identify a newer same-root verified source event", () => {
  const verified = {
    ...base,
    priorWatchId: id,
    watchKind: "continuity_evidence_watch",
    outcomeKind: "continuity_evidence_verified",
  };
  assert.throws(
    () => normalizeOwnerRecheckRenewalWatch(verified, now),
    /needs a newer source event/,
  );
  assert.equal(
    normalizeOwnerRecheckRenewalWatch(
      {
        ...verified,
        verifiedEvidenceEventId: id,
      },
      now,
    ).verifiedEvidenceEventId,
    id,
  );
  assert.throws(
    () =>
      normalizeOwnerRecheckRenewalWatch(
        {
          ...verified,
          outcomeKind: "continuity_evidence_stale",
          verifiedEvidenceEventId: id,
        },
        now,
      ),
    /unresolved exceptions cannot claim one/,
  );
});

test("Build 138 overdue owner cases and continued review have distinct statuses", () => {
  assert.equal(
    classifyOwnerRecheckRenewalWatchStatus(
      { next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "renewal_watch_overdue_30_plus",
  );
  assert.equal(
    classifyOwnerRecheckRenewalWatchStatus(
      { next_due_at: "2026-10-26" },
      null,
      now,
    ),
    "renewal_watch_overdue",
  );
  assert.equal(
    classifyOwnerRecheckRenewalWatchStatus(
      {
        watch_kind: "overdue_exception_disposition",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "overdue_exception_disposition_pending",
  );
  assert.equal(
    classifyOwnerRecheckRenewalWatchStatus(
      {
        watch_kind: "continuity_evidence_watch",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "continuity_evidence_watch_pending",
  );
  assert.equal(
    classifyOwnerRecheckRenewalWatchStatus({}, { id }, now),
    "subsequent_owner_recheck_renewal_recorded",
  );
});

test("Build 138 database source, reviewer, exception and RLS safeguards are present", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0168_owner_recheck_recurrence_renewal_exception_watch.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "owner_recheck_id uuid not null references",
    "prior_watch_id uuid unique references",
    "verified_evidence_event_id uuid unique references",
    "owner_recheck_renewal_first_watch_idx",
    "owner_recheck.recheck_kind<>'verified_owner_audit_recheck'",
    "baseline_proof.root_reopen_id<>original_proof.root_reopen_id",
    "new_proof.root_reopen_id=baseline_proof.root_reopen_id",
    "new_proof.recorded_at>latest_proof_at",
    "owner_recheck_renewal_root_history_idx",
    "new.observed_new_reopenings>0",
    "new.observed_open_recheck_exceptions>0",
    "new.observed_overdue_owner_rechecks>0",
    "new.observed_prior_days_overdue>=30",
    "independent reviewer must differ from the preceding renewal reviewer",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing Build 138 guard: ${guard}`);
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 138 UI supports overdue disposition and source-linked continuity watch", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const part of [
    "recordOwnerRecheckRenewalWatchAction",
    "independent_owner_recheck_recurrence_renewal",
    "overdue_exception_disposition",
    "continuity_evidence_watch",
    "verifiedEvidenceEventId",
    "watch_status",
  ])
    assert.ok(page.includes(part), `Build 138 owner UI missing ${part}`);
});
