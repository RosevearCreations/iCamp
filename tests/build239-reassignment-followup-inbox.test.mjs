import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  needsSlaFollowup,
  validateInboxPage,
  validateSlaFollowup,
} from "../lib/booking-charges/fulfillment-followup-core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dispatchId = "d2b0ef14-c48f-488d-805c-faa09be41b2d";
const previousReviewId = "d2b0ef14-c48f-488d-805c-faa09be41b2e";

test("Build 239 only records a valid, reasoned supervisor follow-up decision", () => {
  assert.deepEqual(
    validateSlaFollowup({
      dispatchId,
      previousReviewId,
      reviewState: "awaiting_worker",
      reviewNote: "  Asked staff to inspect service equipment  ",
    }),
    {
      dispatchId,
      previousReviewId,
      reviewState: "awaiting_worker",
      reviewNote: "Asked staff to inspect service equipment",
    },
  );
  assert.equal(
    validateSlaFollowup({
      dispatchId,
      previousReviewId: "",
      reviewState: "investigating",
      reviewNote: "Checking recorded receipt",
    }).previousReviewId,
    null,
  );
  for (const changes of [
    { dispatchId: "invalid" },
    { previousReviewId: "invalid" },
    { reviewState: "auto_resolved" },
    { reviewNote: " " },
    { reviewNote: "a".repeat(501) },
  ]) {
    assert.throws(() =>
      validateSlaFollowup({
        dispatchId,
        previousReviewId,
        reviewState: "investigating",
        reviewNote: "Valid investigation",
        ...changes,
      }),
    );
  }
});

test("Build 239 signals are sourced from existing dispatch evidence, not assumed", () => {
  assert.equal(needsSlaFollowup(null), false);
  for (const acknowledgement of [
    "overdue",
    "accepted_late",
    "support_requested",
  ]) {
    assert.equal(
      needsSlaFollowup({ acknowledgement, completion: "pending" }),
      true,
    );
  }
  for (const completion of ["overdue", "completed_late"]) {
    assert.equal(
      needsSlaFollowup({ acknowledgement: "accepted_on_time", completion }),
      true,
    );
  }
  assert.equal(
    needsSlaFollowup({
      acknowledgement: "accepted_on_time",
      completion: "completed_on_time",
    }),
    false,
  );
});

test("Build 239 inbox pagination rejects oversized and invalid offsets", () => {
  assert.equal(validateInboxPage("2"), 2);
  for (const value of [undefined, "", "0", "-1", "1e3", "../../", "1000"]) {
    assert.equal(validateInboxPage(value), 1);
  }
  assert.equal(validateInboxPage("999"), 100);
});

test("Build 239 assignment history is generated from actual source updates", () => {
  const migration = read(
    "database/migrations/0224_build239_reassignment_sla_followups.sql",
  );
  const assignments = read("lib/booking-charges/fulfillment-postgres.mjs");
  assert.match(
    migration,
    /after insert or update on public\.service_fulfillment_assignments/u,
  );
  assert.match(
    migration,
    /previous_worker is not distinct from new\.assigned_user_id/u,
  );
  assert.match(
    migration,
    /unique \(campground_id, job_id, assignment_row_version\)/u,
  );
  assert.match(migration, /force row level security/gu);
  assert.match(
    assignments,
    /A new reason is required to reassign or unassign/u,
  );
  assert.doesNotMatch(migration, /update public\.service_fulfillment_jobs/u);
});

test("Build 239 SLA follow-ups are signal-backed, append-only and concurrency-safe", () => {
  const migration = read(
    "database/migrations/0224_build239_reassignment_sla_followups.sql",
  );
  const verify = read(
    "database/verify/0224_build239_reassignment_sla_followups.sql",
  );
  const service = read("lib/booking-charges/fulfillment-dispatch-postgres.mjs");
  assert.match(migration, /worker_support_requested/u);
  assert.match(migration, /acknowledgement_overdue/u);
  assert.match(migration, /completion_overdue/u);
  assert.match(
    migration,
    /new\.previous_review_id is distinct from latest_review_id/u,
  );
  assert.match(migration, /unique \(dispatch_id, previous_review_id\)/u);
  assert.match(
    migration,
    /service_fulfillment_sla_followups_first_unique_idx/u,
  );
  assert.match(verify, /Build 239 source history must be immutable/u);
  assert.match(service, /appendAuditEvent\(client/u);
  assert.match(service, /staff\.manage/u);
});

test("Build 239 worker inbox is identity-scoped, paginated and mobile accessible", () => {
  const service = read("lib/booking-charges/fulfillment-dispatch-postgres.mjs");
  const page = read(
    "app/workspaces/management/campgrounds/worker-inbox/page.tsx",
  );
  const css = read(
    "app/workspaces/management/campgrounds/worker-inbox/inbox.module.css",
  );
  assert.match(service, /d\.assigned_user_id = \$2/u);
  assert.match(service, /limit 21 offset \$3/u);
  assert.match(page, /requireStaff\(path\)/u);
  assert.match(page, /reservation\.modify/u);
  assert.match(page, /Record my response/u);
  assert.match(
    page,
    /<nav className=\{styles\.pager\} aria-label="Inbox pagination">/u,
  );
  assert.match(css, /@media \(max-width: 480px\)/u);
  assert.doesNotMatch(page, /staff\.manage/u);
});
