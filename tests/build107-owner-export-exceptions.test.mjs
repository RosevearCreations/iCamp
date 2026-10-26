import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeExportExceptionCase,
  normalizeExportExceptionOutcome,
  normalizeExportExceptionReview,
  activeExportException,
  exceptionCorrectionReady,
} from "../lib/permanent-unit-owner-retention/exceptions-core.mjs";

const source = "107b0000-0000-4000-8000-000000000001";
const target = "107b0000-0000-4000-8000-000000000002";
const id = "107b0000-0000-4000-8000-000000000003";
const receipt = "107b0000-0000-4000-8000-000000000004";
const outcome = "107b0000-0000-4000-8000-000000000005";
const now = new Date("2026-10-25T08:00:00.000Z");
const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8").toLowerCase();
const base = {
  id,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  evidenceReference: "owner-exception-evidence-107",
};

test("exception classification derives from immutable source receipts instead of owner assertions", () => {
  assert.equal(
    activeExportException(undefined, undefined, now),
    "reconciliation_missing",
  );
  assert.equal(
    activeExportException({ result: "mismatch" }, undefined, now),
    "digest_mismatch",
  );
  assert.equal(
    activeExportException({ result: "matched" }, undefined, now),
    "retention_missing",
  );
  assert.equal(
    activeExportException(
      { result: "matched" },
      { eventKind: "retained", retentionDueAt: "2026-10-24T23:59:00.000Z" },
      now,
    ),
    "retention_overdue",
  );
  assert.equal(
    activeExportException(
      { result: "matched" },
      { eventKind: "extended", retentionDueAt: "2026-11-25T23:59:00.000Z" },
      now,
    ),
    null,
  );
  assert.equal(
    activeExportException(
      { result: "matched" },
      { eventKind: "copy_disposed", retentionDueAt: null },
      now,
    ),
    null,
  );
});
test("corrective evidence is mandatory for review-ready case outcomes", () => {
  assert.equal(
    exceptionCorrectionReady(
      "digest_mismatch",
      { result: "mismatch" },
      null,
      now,
    ),
    false,
  );
  assert.equal(
    exceptionCorrectionReady(
      "digest_mismatch",
      { result: "matched" },
      null,
      now,
    ),
    true,
  );
  assert.equal(
    exceptionCorrectionReady(
      "reconciliation_missing",
      { result: "matched" },
      null,
      now,
    ),
    true,
  );
  assert.equal(
    exceptionCorrectionReady(
      "retention_missing",
      { result: "matched" },
      null,
      now,
    ),
    false,
  );
  assert.equal(
    exceptionCorrectionReady(
      "retention_overdue",
      { result: "matched" },
      { eventKind: "extended", retentionDueAt: "2026-10-24T23:59:00.000Z" },
      now,
    ),
    false,
  );
  assert.equal(
    exceptionCorrectionReady(
      "retention_overdue",
      { result: "matched" },
      { eventKind: "copy_disposed", retentionDueAt: null },
      now,
    ),
    true,
  );
  assert.equal(
    exceptionCorrectionReady("forged_kind", { result: "matched" }, null, now),
    false,
  );
});
test("opening an exception requires a source receipt, legitimate kind, bounded UTC action and safe evidence", () => {
  const input = {
    ...base,
    exportAcceptanceId: receipt,
    issueKind: "digest_mismatch",
    actionDueAt: "2026-11-25",
    issueNote: "Verify a mismatching owner export CSV independently.",
  };
  assert.equal(
    normalizeExportExceptionCase(input, now).issueKind,
    "digest_mismatch",
  );
  for (const change of [
    { exportAcceptanceId: "missing" },
    { targetCampgroundId: source },
    { issueKind: "approve_financing" },
    { actionDueAt: "2026-10-24" },
    { actionDueAt: "2027-06-01" },
    { actionDueAt: "2026-02-30" },
    { issueNote: "short" },
    { evidenceReference: "private.person@example.com" },
  ])
    assert.throws(() =>
      normalizeExportExceptionCase({ ...input, ...change }, now),
    );
});
test("owner follow-up and independent acceptance validate action/review contracts", () => {
  const action = {
    ...base,
    caseId: receipt,
    actionKind: "followup_needed",
    nextDueAt: "2026-11-01",
    actionNote: "Owner will independently reconcile the source evidence.",
  };
  assert.match(
    normalizeExportExceptionOutcome(action, now).nextDueAt,
    /^2026-11-01/,
  );
  assert.equal(
    normalizeExportExceptionOutcome(
      { ...action, actionKind: "review_ready", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  for (const change of [
    { actionKind: "accepted" },
    { nextDueAt: "2027-01-30" },
    { actionKind: "review_ready", nextDueAt: "2026-11-01" },
    { actionNote: "Bank account 123456789" },
  ])
    assert.throws(() =>
      normalizeExportExceptionOutcome({ ...action, ...change }, now),
    );
  const review = {
    ...base,
    caseId: receipt,
    outcomeId: outcome,
    reviewKind: "accepted",
    reviewNote: "Independent owner checked current immutable source proof.",
  };
  assert.equal(normalizeExportExceptionReview(review).outcomeId, outcome);
  for (const change of [
    { reviewKind: "release_hold" },
    { outcomeId: "invalid" },
    { reviewNote: "short" },
  ])
    assert.throws(() =>
      normalizeExportExceptionReview({ ...review, ...change }),
    );
});
test("database checks and operator routes enforce private source-linked, independent append-only closeout", () => {
  const sql = read(
    "../database/migrations/0138_owner_export_exception_followup_closeout.sql",
  );
  const verify = read(
    "../database/verify/0138_owner_export_exception_followup_closeout.sql",
  );
  const pg = read(
    "../lib/permanent-unit-owner-retention/exceptions-postgres.mjs",
  );
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/page.tsx",
  );
  for (const needle of [
    "force row level security",
    "winterization_append_only",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "pg_advisory_xact_lock",
    "106106",
    "90 days",
    "one unresolved owner export exception",
    "reconciliation_missing",
    "digest_mismatch",
    "retention_overdue",
    "review_ready",
    "original exception must be corrected",
    "new.reviewed_by_user_id=outcome.recorded_by_user_id",
    "new.reviewed_by_user_id=parent.opened_by_user_id",
    "is distinct from",
    "revoke all",
  ])
    assert.ok(sql.includes(needle), needle);
  for (const needle of [
    "relforcerowsecurity",
    "has_table_privilege",
    "independent reviewer",
    "corrective source evidence",
  ])
    assert.ok(verify.includes(needle), needle);
  for (const needle of [
    "set local role icamp_app",
    "getcampgroundauthorization",
    "owner_admin",
    "permanent_unit.transfer",
    "limit 91",
    "limit 301",
  ])
    assert.ok(pg.includes(needle), needle);
  assert.ok(page.includes('helptopic="permanent.owner-exception-closeout"'));
  assert.ok(page.includes("recordexportexceptionoutcomeaction"));
  for (const forbidden of [
    "update public.",
    "delete from public.",
    "insert into public.permanent_unit_financing",
    "buyer_display_name",
    "credit_score",
  ])
    assert.equal(pg.includes(forbidden), false, forbidden);
});
