import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeClosureAuditOwnerSignoff,
  classifyClosureAuditOwnerSignoff,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  independentAuditId: "e6666666-6666-4666-8666-666666666666",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  signoffKind: "request_evidence_refresh",
  nextDueAt: "2026-11-12",
  evidenceReference: "Independent exception evidence 123",
  signoffNote:
    "Request additional independent evidence before the scheduled owner reassessment.",
};

test("Build 123 validates owner exception sign-off, ordered pairs and UTC deadlines", () => {
  assert.equal(
    normalizeClosureAuditOwnerSignoff(input, now).nextDueAt,
    "2026-11-12T23:59:00.000Z",
  );
  for (const signoffKind of ["silent_release", "operator_override", ""]) {
    assert.throws(
      () => normalizeClosureAuditOwnerSignoff({ ...input, signoffKind }, now),
      /Unknown closure audit/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () => normalizeClosureAuditOwnerSignoff({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeClosureAuditOwnerSignoff(
        { ...input, signoffKind: "acknowledge_independent_closure" },
        now,
      ),
    /no open due date/,
  );
  assert.equal(
    normalizeClosureAuditOwnerSignoff(
      {
        ...input,
        signoffKind: "acknowledge_independent_closure",
        nextDueAt: "",
      },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeClosureAuditOwnerSignoff(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 123 displays reassessment aging and owner escalation sign-off outcomes", () => {
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      { audit_kind: "independent_audit_closed" },
      null,
      now,
    ),
    "awaiting_owner_closure_acknowledgment",
  );
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      {
        audit_kind: "request_evidence_reassessment",
        next_due_at: "2026-08-01",
      },
      null,
      now,
    ),
    "independent_reassessment_overdue_30_plus",
  );
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      { audit_kind: "continue_exception", next_due_at: "2026-10-25" },
      null,
      now,
    ),
    "independent_reassessment_overdue",
  );
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      { audit_kind: "manual_escalation", next_due_at: "2026-11-12" },
      null,
      now,
    ),
    "escalation_owner_signoff_pending",
  );
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      {},
      { signoff_kind: "accept_manual_escalation" },
      now,
    ),
    "owner_escalation_accepted",
  );
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      {},
      { signoff_kind: "owner_exception_signed_off" },
      now,
    ),
    "owner_exception_signed_off_open",
  );
  assert.equal(
    classifyClosureAuditOwnerSignoff(
      {},
      { signoff_kind: "acknowledge_independent_closure" },
      now,
    ),
    "independent_closure_acknowledged",
  );
});

test("Build 123 database enforces independent signers, recurrence, immutable history and RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0153_closure_audit_owner_signoff_escalation_recurrence.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "independent_audit_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "signed_by_user_id=audit_record.audited_by_user_id",
    "signed_by_user_id=handoff_record.acted_by_user_id",
    "signed_by_user_id=review_record.reviewed_by_user_id",
    "observed_reassessment_days_overdue",
    "observed_peer_open_audits",
    "observed_peer_overdue_audits",
    "observed_prior_manual_escalations",
    "observed_reassessment_days_overdue>=30",
    "observed_prior_manual_escalations>=2",
    "owner_exception_signed_off",
    "accept_manual_escalation",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing Build 123 invariant: ${invariant}`,
    );
  assert.ok(
    !/update public\.owner_export_handoff_independent_closure_audits/i.test(
      sql,
    ),
  );
});

test("Build 123 management surface connects immutable owner sign-off to peer recurrence", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordClosureAuditOwnerSignoffAction/);
  assert.match(page, /owner_signoff_status/);
  assert.match(page, /observed_prior_manual_escalations/);
  assert.match(page, /observed_peer_overdue_audits/);
});
