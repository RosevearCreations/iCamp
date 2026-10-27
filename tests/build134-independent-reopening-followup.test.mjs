import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeReopeningFollowupOversight,
  classifyReopeningFollowupStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const prior = "e5555555-5555-4555-8555-555555555555";
const input = {
  id: "a1111111-1111-4111-8111-111111111111",
  verifiedMonitorId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  oversightKind: "independent_reopening_followup",
  outcomeKind: "reopening_evidence_gap",
  nextDueAt: "2026-11-15",
  evidenceReference: "Reopening follow-up source evidence",
  oversightNote:
    "Separate independent reviewer found a renewed source documentation gap.",
};

test("Build 134 limits independent reopening outcomes and UTC follow-up windows", () => {
  assert.equal(
    normalizeReopeningFollowupOversight(input, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeReopeningFollowupOversight(
        {
          ...input,
          oversightKind: "owner_escalation_oversight",
          outcomeKind: "owner_escalation_pending",
        },
        now,
      ),
    /must follow an independent reopening review/,
  );
  assert.throws(
    () =>
      normalizeReopeningFollowupOversight(
        { ...input, outcomeKind: "release_hold" },
        now,
      ),
    /Invalid independent reopening/,
  );
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-01"]) {
    assert.throws(
      () => normalizeReopeningFollowupOversight({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeReopeningFollowupOversight(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 134 source-verified decision replay and escalation closure need real event links", () => {
  const replay = {
    ...input,
    priorOversightId: prior,
    oversightKind: "closure_recurrence_decision_replay",
    outcomeKind: "replay_continuity_confirmed",
    verifiedResolutionEventId: prior,
  };
  assert.equal(
    normalizeReopeningFollowupOversight(replay, now).verifiedResolutionEventId,
    prior,
  );
  assert.throws(
    () =>
      normalizeReopeningFollowupOversight(
        { ...replay, verifiedResolutionEventId: "" },
        now,
      ),
    /needs its matching evidence event/,
  );
  const resolved = {
    ...replay,
    oversightKind: "owner_escalation_oversight",
    outcomeKind: "owner_escalation_resolved",
    nextDueAt: "",
  };
  assert.equal(
    normalizeReopeningFollowupOversight(resolved, now).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeReopeningFollowupOversight(
        { ...resolved, nextDueAt: "2026-11-15" },
        now,
      ),
    /cannot retain a due date/,
  );
  assert.throws(
    () =>
      normalizeReopeningFollowupOversight(
        { ...input, verifiedResolutionEventId: prior },
        now,
      ),
    /open reviews cannot claim one/,
  );
});

test("Build 134 distinguishes 30-day aging and independent escalation oversight", () => {
  assert.equal(
    classifyReopeningFollowupStatus(
      {
        oversight_kind: "independent_reopening_followup",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "reopening_followup_overdue_30_plus",
  );
  assert.equal(
    classifyReopeningFollowupStatus({ next_due_at: "2026-10-26" }, null, now),
    "reopening_followup_overdue",
  );
  assert.equal(
    classifyReopeningFollowupStatus(
      {
        oversight_kind: "closure_recurrence_decision_replay",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "closure_decision_replay_pending",
  );
  assert.equal(
    classifyReopeningFollowupStatus(
      {
        oversight_kind: "owner_escalation_oversight",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "owner_escalation_oversight_pending",
  );
  assert.equal(
    classifyReopeningFollowupStatus(
      { outcome_kind: "owner_escalation_resolved" },
      null,
      now,
    ),
    "source_verified_owner_escalation_resolution",
  );
  assert.equal(
    classifyReopeningFollowupStatus({}, { id: prior }, now),
    "subsequent_reopening_oversight_recorded",
  );
});

test("Build 134 SQL protects source-linked proof, ordered independent replay and immutable RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0164_independent_reopening_followup_replay_oversight.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "verified_monitor_id uuid not null references",
    "prior_oversight_id uuid unique references",
    "verified_resolution_event_id uuid references",
    "reopening_followup_first_idx",
    "pg_advisory_xact_lock",
    "monitor_record.outcome_kind<>'verified_reopening_linked'",
    "root_reopen_id=reopening_record.id",
    "independent reviewer must differ",
    "new.observed_prior_days_overdue>=30",
    "escalation closure requires independent prior oversight and verified, exception-free source proof",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing Build 134 SQL guard: ${guard}`);
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 134 operator queue and source-linked history are visible", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const item of [
    "recordReopeningFollowupOversightAction",
    "independent_reopening_followup",
    "closure_recurrence_decision_replay",
    "owner_escalation_oversight",
    "verifiedResolutionEventId",
    "oversight_status",
  ])
    assert.ok(page.includes(item), `Missing Build 134 operator flow: ${item}`);
});
