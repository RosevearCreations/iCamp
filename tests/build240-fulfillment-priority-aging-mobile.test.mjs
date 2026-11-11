import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  agingBand,
  classifyFulfillmentPriority,
  compareFulfillmentPriority,
  matchesFulfillmentPriorityFilter,
  validateFulfillmentPriorityFilter,
  validateFulfillmentPriorityPage,
  workerRecoveryGuidance,
} from "../lib/booking-charges/fulfillment-priority-core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const now = "2026-11-10T12:00:00Z";
const dispatch = {
  id: "f2d0ef14-c48f-488d-805c-faa09be41b2d",
  jobId: "a2d0ef14-c48f-488d-805c-faa09be41b2d",
  assignedUserId: "b2d0ef14-c48f-488d-805c-faa09be41b2d",
  dispatchedAt: "2026-11-10T09:00:00Z",
  acknowledgementDueAt: "2026-11-10T10:00:00Z",
  completionDueAt: "2026-11-10T11:00:00Z",
  acknowledgedAt: null,
  completedAt: null,
  response: null,
};
const status = (acknowledgement, completion = "pending", extra = {}) => ({
  status: "current",
  acknowledgement,
  completion,
  canAcknowledge: acknowledgement === "overdue",
  ...extra,
});

test("Build 240 classifies active overdue evidence and honest aging bands", () => {
  const priority = classifyFulfillmentPriority({
    dispatch,
    classification: status("overdue", "overdue"),
    now,
  });
  assert.equal(priority.category, "overdue");
  assert.equal(priority.title, "Acknowledgement and completion overdue");
  assert.equal(priority.ageSource, "Acknowledgement deadline");
  assert.equal(priority.ageMinutes, 120);
  assert.equal(priority.ageBand, "1–4 hours");
  assert.equal(priority.isOpen, true);
  assert.equal(agingBand(null), "Unknown");
  assert.equal(agingBand(0), "Under 1 hour");
  assert.equal(agingBand(60), "1–4 hours");
  assert.equal(agingBand(240), "4–24 hours");
  assert.equal(agingBand(1440), "24+ hours");
});

test("Build 240 support requests are sorted above overdue assignments", () => {
  const supportCase = {
    dispatch: { ...dispatch, id: "00000000-c48f-488d-805c-faa09be41b2d" },
    priority: classifyFulfillmentPriority({
      dispatch: { ...dispatch, acknowledgedAt: "2026-11-10T10:30:00Z" },
      classification: status("support_requested", "pending"),
      now,
    }),
  };
  const overdueCase = {
    dispatch,
    priority: classifyFulfillmentPriority({
      dispatch,
      classification: status("overdue", "pending"),
      now,
    }),
  };
  assert.equal(supportCase.priority.category, "support");
  assert.equal(supportCase.priority.ageMinutes, 90);
  assert.equal(
    [overdueCase, supportCase].sort(compareFulfillmentPriority)[0],
    supportCase,
  );
  assert.equal(
    matchesFulfillmentPriorityFilter(supportCase.priority, "support"),
    true,
  );
  assert.equal(
    matchesFulfillmentPriorityFilter(supportCase.priority, "overdue"),
    false,
  );
});

test("Build 240 resolution freezes age, while an ongoing overdue source fails closed", () => {
  const resolvedReview = {
    state: "resolved",
    reviewedAt: "2026-11-10T11:00:00Z",
  };
  const resolved = classifyFulfillmentPriority({
    dispatch: { ...dispatch, acknowledgedAt: "2026-11-10T10:10:00Z" },
    classification: status("accepted_late", "pending"),
    followup: resolvedReview,
    now,
  });
  assert.equal(resolved.category, "resolved");
  assert.equal(resolved.ageMinutes, 60);
  assert.equal(resolved.isOpen, false);
  const recheck = classifyFulfillmentPriority({
    dispatch,
    classification: status("overdue", "pending"),
    followup: resolvedReview,
    now,
  });
  assert.equal(recheck.category, "recheck");
  assert.equal(recheck.isOpen, true);
  assert.equal(matchesFulfillmentPriorityFilter(recheck, "overdue"), true);
});

test("Build 240 treats superseded handoffs as history with unmeasurable end time", () => {
  const priority = classifyFulfillmentPriority({
    dispatch,
    classification: status("overdue", "overdue", { status: "superseded" }),
    now,
  });
  assert.equal(priority.category, "history");
  assert.equal(priority.ageMinutes, null);
  assert.equal(priority.ageBand, "Unknown");
  assert.equal(priority.isOpen, false);
  assert.equal(matchesFulfillmentPriorityFilter(priority, "open"), false);
  assert.equal(matchesFulfillmentPriorityFilter(priority, "history"), true);
});

test("Build 240 missing or invalid evidence cannot become an automatic success", () => {
  const unknown = classifyFulfillmentPriority({
    dispatch,
    classification: null,
    now,
  });
  assert.equal(unknown.category, "unknown");
  assert.equal(unknown.isOpen, true);
  assert.equal(unknown.ageMinutes, null);
  assert.equal(
    classifyFulfillmentPriority({
      dispatch,
      classification: status("overdue"),
      now: "invalid",
    }).category,
    "unknown",
  );
});

test("Build 240 validates filters and pages without accepting arbitrary query values", () => {
  for (const filter of [
    "open",
    "overdue",
    "support",
    "reviewed",
    "history",
    "all",
  ]) {
    assert.equal(validateFulfillmentPriorityFilter(filter), filter);
  }
  assert.equal(validateFulfillmentPriorityFilter("../all"), "open");
  assert.equal(validateFulfillmentPriorityPage("12"), 12);
  assert.equal(validateFulfillmentPriorityPage("999"), 100);
  assert.equal(validateFulfillmentPriorityPage("-1"), 1);
});

test("Build 240 mobile recovery guides current and superseded workers without mutating work", () => {
  assert.match(workerRecoveryGuidance(null).step, /Refresh your inbox/u);
  assert.match(
    workerRecoveryGuidance(status("overdue")).title,
    /deadline passed/u,
  );
  assert.match(
    workerRecoveryGuidance(status("support_requested")).step,
    /supervisor/u,
  );
  assert.match(
    workerRecoveryGuidance(status("accepted_on_time", "overdue")).step,
    /does not mark the job complete/u,
  );
  assert.equal(workerRecoveryGuidance(status("accepted_late")).urgent, false);
  assert.match(
    workerRecoveryGuidance(
      status("overdue", "pending", { status: "superseded" }),
    ).title,
    /do not act/u,
  );
});

test("Build 240 supervisor page is two-permission tenant-gated and worker page stays scoped", () => {
  const page = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/page.tsx",
  );
  const worker = read(
    "app/workspaces/management/campgrounds/worker-inbox/page.tsx",
  );
  const source = read("lib/booking-charges/fulfillment-dispatch-postgres.mjs");
  assert.match(page, /requireStaff\(path\)/u);
  assert.match(page, /grant\.permissions\.includes\("staff\.manage"\)/u);
  assert.match(
    page,
    /grant\?\.permissions\.includes\("reservation\.modify"\)/u,
  );
  assert.match(page, /getCampgroundAuthorization/u);
  assert.match(page, /listCampgroundSlaFollowups/u);
  assert.match(page, /role="alert"/u);
  assert.match(page, /aria-label="Priority case pagination"/u);
  assert.match(source, /set local role icamp_app/u);
  assert.match(source, /where d\.campground_id = \$1/u);
  assert.match(source, /d\.assigned_user_id = \$2/u);
  assert.match(worker, /workerRecoveryGuidance/u);
  assert.match(worker, /aria-label="Mobile handoff recovery guidance"/u);
  assert.doesNotMatch(worker, /staff\.manage/u);
});
