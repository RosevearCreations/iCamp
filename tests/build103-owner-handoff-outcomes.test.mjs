import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeHandoffOutcome,
  normalizeHandoffResolution,
  latestOutcomesByPlan,
  canResolveOutcome,
} from "../lib/permanent-unit-owner-outcomes/core.mjs";

const now = new Date("2026-10-25T12:00:00.000Z");
const source = "103b0000-0000-4000-8000-000000000001";
const target = "103b0000-0000-4000-8000-000000000002";
const planId = "103b0000-0000-4000-8000-000000000003";
const outcomeId = "103b0000-0000-4000-8000-000000000004";
const base = {
  id: outcomeId,
  planId,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  evidenceReference: "internal-ops-ref-103",
  ownerNote: "Owner coordination planning noted for the team.",
};

test("open owner outcomes require bounded future follow-up and never accept private financial data", () => {
  const valid = normalizeHandoffOutcome(
    {
      ...base,
      outcomeKind: "coordination_in_progress",
      nextActionAt: "2026-11-01",
    },
    now,
  );
  assert.equal(valid.nextActionAt, "2026-11-01T23:59:00.000Z");
  for (const values of [
    { outcomeKind: "unknown" },
    { nextActionAt: "2026-10-24" },
    { nextActionAt: "2027-03-31" },
    { nextActionAt: "" },
    { targetCampgroundId: source },
    { evidenceReference: "Email applicant@example.com" },
    { ownerNote: "Account number 123456789 for applicant" },
  ])
    assert.throws(() =>
      normalizeHandoffOutcome(
        {
          ...base,
          outcomeKind: "coordination_in_progress",
          nextActionAt: "2026-11-01",
          ...values,
        },
        now,
      ),
    );
});

test("terminal outcomes cannot imply a pending action, but can support a separate resolution", () => {
  const done = normalizeHandoffOutcome(
    { ...base, outcomeKind: "target_review_completed", nextActionAt: "" },
    now,
  );
  assert.equal(done.nextActionAt, null);
  assert.throws(() =>
    normalizeHandoffOutcome(
      { ...base, outcomeKind: "unable_to_proceed", nextActionAt: "2026-11-01" },
      now,
    ),
  );
  const resolution = normalizeHandoffResolution({
    ...base,
    latestOutcomeId: outcomeId,
    resolutionKind: "owner_coordination_complete",
  });
  assert.equal(resolution.latestOutcomeId, outcomeId);
  assert.equal(canResolveOutcome(done, false), true);
  assert.equal(canResolveOutcome(done, true), false);
  assert.equal(
    canResolveOutcome({ outcomeKind: "additional_review_needed" }, false),
    false,
  );
  assert.throws(() =>
    normalizeHandoffResolution({
      ...base,
      latestOutcomeId: outcomeId,
      resolutionKind: "auto_release_financing_hold",
    }),
  );
});

test("planning resolution eligibility follows latest record, not an older terminal outcome", () => {
  const outcomes = [
    {
      id: outcomeId,
      planId,
      outcomeKind: "target_review_completed",
      recordedAt: "2026-10-23T12:00:00Z",
    },
    {
      id: "103b0000-0000-4000-8000-000000000005",
      planId,
      outcomeKind: "additional_review_needed",
      recordedAt: "2026-10-25T12:00:00Z",
    },
  ];
  const latest = latestOutcomesByPlan(outcomes).get(planId);
  assert.equal(latest.outcomeKind, "additional_review_needed");
  assert.equal(canResolveOutcome(latest, false), false);
});

test("immutable SQL and server paths require dual campground owner authorization", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0134_owner_handoff_outcomes_resolution.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  const verification = readFileSync(
    new URL(
      "../database/verify/0134_owner_handoff_outcomes_resolution.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  const backend = readFileSync(
    new URL(
      "../lib/permanent-unit-owner-outcomes/postgres.mjs",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const expected of [
    "force row level security",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "latest_outcome_id",
    "plan_id uuid not null unique",
    "revoke all",
  ])
    assert.ok(migration.includes(expected), expected);
  for (const expected of [
    "relforcerowsecurity",
    "has_table_privilege",
    "dual-campground",
    "immutable trigger",
  ])
    assert.ok(verification.includes(expected), expected);
  for (const expected of [
    "getcampgroundauthorization",
    "permanent_unit.transfer",
    "owner_admin",
    "set local role icamp_app",
    "source_campground_id=any",
    "target_campground_id=any",
  ])
    assert.ok(backend.includes(expected), expected);
  for (const forbidden of [
    "credit_score",
    "buyer_display_name",
    "update public.",
    "delete from public.",
    "insert into public.permanent_unit_financing",
  ])
    assert.equal(backend.includes(forbidden), false, forbidden);
});
