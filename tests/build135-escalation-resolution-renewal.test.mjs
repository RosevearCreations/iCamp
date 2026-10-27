import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeEscalationResolutionRenewal,
  classifyEscalationResolutionRenewalStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const id = "a1111111-1111-4111-8111-111111111111";
const sourceCampgroundId = "c3333333-3333-4333-8333-333333333333";
const targetCampgroundId = "d4444444-4444-4444-8444-444444444444";
const input = {
  id,
  resolvedOversightId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId,
  targetCampgroundId,
  renewalKind: "independent_resolution_followup",
  outcomeKind: "resolution_evidence_gap",
  nextDueAt: "2026-11-15",
  evidenceReference: "Independent resolution renewal evidence reference",
  renewalNote:
    "Follow-up needs renewed source evidence before it can be cleared.",
};

test("Build 135 enforces independent first step, tenant pair and UTC renewal due date", () => {
  assert.equal(
    normalizeEscalationResolutionRenewal(input, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  for (const bad of ["2026-10-26", "2026-11-31", "2027-03-01"]) {
    assert.throws(
      () =>
        normalizeEscalationResolutionRenewal({ ...input, nextDueAt: bad }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeEscalationResolutionRenewal(
        {
          ...input,
          renewalKind: "owner_evidence_renewal",
          outcomeKind: "owner_evidence_pending",
        },
        now,
      ),
    /must begin with an independent resolution follow-up/,
  );
  assert.throws(
    () =>
      normalizeEscalationResolutionRenewal(
        {
          ...input,
          targetCampgroundId: sourceCampgroundId,
        },
        now,
      ),
    /different campgrounds/,
  );
  assert.throws(
    () =>
      normalizeEscalationResolutionRenewal(
        { ...input, outcomeKind: "auto_release" },
        now,
      ),
    /Invalid independent escalation renewal/,
  );
});

test("Build 135 positive renewal and recurrence watch need a fresh linked source event", () => {
  for (const [renewalKind, outcomeKind] of [
    ["independent_resolution_followup", "resolution_evidence_current"],
    ["reopening_recurrence_watch", "recurrence_watch_stable"],
    ["owner_evidence_renewal", "owner_evidence_renewed"],
  ]) {
    const request = {
      ...input,
      priorRenewalId:
        renewalKind === "independent_resolution_followup" ? "" : id,
      renewalKind,
      outcomeKind,
    };
    assert.throws(
      () => normalizeEscalationResolutionRenewal(request, now),
      /need a fresh same-root source event/,
    );
    assert.equal(
      normalizeEscalationResolutionRenewal(
        { ...request, renewalEvidenceEventId: id },
        now,
      ).renewalEvidenceEventId,
      id,
    );
  }
  assert.throws(
    () =>
      normalizeEscalationResolutionRenewal(
        { ...input, renewalEvidenceEventId: id },
        now,
      ),
    /open findings cannot claim it/,
  );
});

test("Build 135 classifies overdue independent follow-up, watch and owner renewal", () => {
  assert.equal(
    classifyEscalationResolutionRenewalStatus(
      { next_due_at: "2026-09-01", renewal_kind: "owner_evidence_renewal" },
      null,
      now,
    ),
    "escalation_renewal_overdue_30_plus",
  );
  assert.equal(
    classifyEscalationResolutionRenewalStatus(
      { next_due_at: "2026-10-26" },
      null,
      now,
    ),
    "escalation_renewal_overdue",
  );
  assert.equal(
    classifyEscalationResolutionRenewalStatus(
      {
        renewal_kind: "reopening_recurrence_watch",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "reopening_recurrence_watch_pending",
  );
  assert.equal(
    classifyEscalationResolutionRenewalStatus(
      {
        renewal_kind: "owner_evidence_renewal",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "owner_evidence_renewal_pending",
  );
  assert.equal(
    classifyEscalationResolutionRenewalStatus({}, { id }, now),
    "subsequent_independent_renewal_recorded",
  );
});

test("Build 135 SQL requires resolved source, new proof, independent reviewers and append-only RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0165_independent_escalation_resolution_renewal.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "resolved_oversight_id uuid not null references",
    "prior_renewal_id uuid unique references",
    "renewal_evidence_event_id uuid unique references",
    "escalation_resolution_first_renewal_idx",
    "pg_advisory_xact_lock",
    "resolved_record.outcome_kind<>'owner_escalation_resolved'",
    "renewal_proof.root_reopen_id=reopened_record.id",
    "renewal_proof.recorded_at>baseline_proof.recorded_at",
    "new.observed_new_reopenings>0",
    "new.observed_prior_days_overdue>=30",
    "renewal reviewer must differ from the preceding reviewer",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(guard),
      `Missing Build 135 security guard: ${guard}`,
    );
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 135 operator queue, action and immutable history are visible", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const key of [
    "recordEscalationResolutionRenewalAction",
    "independent_resolution_followup",
    "reopening_recurrence_watch",
    "owner_evidence_renewal",
    "renewalEvidenceEventId",
    "renewal_status",
  ])
    assert.ok(page.includes(key), `Missing Build 135 UI field: ${key}`);
});
