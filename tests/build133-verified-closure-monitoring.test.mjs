import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeVerifiedClosureMonitor,
  classifyVerifiedClosureMonitorStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const input = {
  id: "a1111111-1111-4111-8111-111111111111",
  closureFollowupId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  monitorKind: "verified_closure_recurrence_monitor",
  outcomeKind: "closure_watch_stable",
  nextDueAt: "2026-11-15",
  evidenceReference: "Build 133 source-linked closure watch",
  monitorNote:
    "Separate owner auditor reviewed the closure source and recurrence watch.",
};
const previous = "e5555555-5555-4555-8555-555555555555";

test("Build 133 allows only valid monitoring outcomes and UTC due dates", () => {
  assert.equal(
    normalizeVerifiedClosureMonitor(input, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeVerifiedClosureMonitor(
        {
          ...input,
          monitorKind: "independent_evidence_renewal",
          outcomeKind: "renewal_evidence_pending",
        },
        now,
      ),
    /preceding closure monitor/,
  );
  assert.throws(
    () =>
      normalizeVerifiedClosureMonitor(
        { ...input, outcomeKind: "release_hold" },
        now,
      ),
    /Invalid verified closure/,
  );
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-01"]) {
    assert.throws(
      () => normalizeVerifiedClosureMonitor({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeVerifiedClosureMonitor(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 133 requires actual source linked reopening before claiming verification", () => {
  const linked = {
    ...input,
    monitorKind: "overdue_exception_reopening_audit",
    outcomeKind: "verified_reopening_linked",
    priorMonitorId: previous,
    linkedReopenEventId: previous,
    nextDueAt: "",
  };
  assert.equal(normalizeVerifiedClosureMonitor(linked, now).nextDueAt, null);
  assert.throws(
    () =>
      normalizeVerifiedClosureMonitor(
        { ...linked, linkedReopenEventId: "" },
        now,
      ),
    /linked owner reopening event/,
  );
  assert.throws(
    () =>
      normalizeVerifiedClosureMonitor(
        { ...linked, nextDueAt: "2026-11-15" },
        now,
      ),
    /open due date/,
  );
  assert.throws(
    () =>
      normalizeVerifiedClosureMonitor(
        { ...input, linkedReopenEventId: previous },
        now,
      ),
    /pending reviews cannot cite/,
  );
});

test("Build 133 status distinguishes overdue, renewed monitoring and linked owner reopen", () => {
  assert.equal(
    classifyVerifiedClosureMonitorStatus(
      {
        monitor_kind: "independent_evidence_renewal",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "closure_monitor_overdue_30_plus",
  );
  assert.equal(
    classifyVerifiedClosureMonitorStatus(
      {
        monitor_kind: "verified_closure_recurrence_monitor",
        next_due_at: "2026-10-26",
      },
      null,
      now,
    ),
    "closure_monitor_overdue",
  );
  assert.equal(
    classifyVerifiedClosureMonitorStatus(
      {
        monitor_kind: "verified_closure_recurrence_monitor",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "verified_closure_recurrence_watch_pending",
  );
  assert.equal(
    classifyVerifiedClosureMonitorStatus(
      {
        monitor_kind: "independent_evidence_renewal",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "independent_evidence_renewal_pending",
  );
  assert.equal(
    classifyVerifiedClosureMonitorStatus(
      { outcome_kind: "verified_reopening_linked" },
      null,
      now,
    ),
    "new_owner_reopening_independently_verified",
  );
  assert.equal(
    classifyVerifiedClosureMonitorStatus({}, { id: previous }, now),
    "subsequent_renewal_or_recheck_recorded",
  );
});

test("Build 133 SQL enforces source proofs, staged independent review and immutable tenant-scoped RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0163_verified_closure_recurrence_renewal_reopen.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "closure_followup_id uuid not null references",
    "prior_monitor_id uuid unique references",
    "linked_reopen_event_id uuid references",
    "verified_closure_monitor_first_idx",
    "pg_advisory_xact_lock",
    "closure_record.outcome_kind<>'closure_followup_verified'",
    "proof_event.recorded_at<=closure_record.recorded_at",
    "reopening must remain in order",
    "independent evidence reviewer must differ",
    "new.observed_prior_days_overdue>=30",
    "reopened_record.recorded_at>closure_record.recorded_at",
    "newer same-pair owner reopening",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing Build 133 SQL guard: ${guard}`);
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 133 owner queue and source-linked audit receipt are visible", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const item of [
    "recordVerifiedClosureMonitorAction",
    "verified_closure_recurrence_monitor",
    "independent_evidence_renewal",
    "overdue_exception_reopening_audit",
    "linkedReopenEventId",
    "monitoring_status",
  ]) {
    assert.ok(
      page.includes(item),
      `Missing Build 133 owner operator flow: ${item}`,
    );
  }
});
