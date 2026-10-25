import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSpringOwnerReview } from "../lib/spring-reopening/owner-review.mjs";

const site = { id: "site", code: "R01", lifecycle_state: "active" };
const input = {
  campgroundActive: true,
  accommodations: [site],
  assignments: [
    { accommodation_id: "site", occupancy_state: "reopened", id: "a" },
  ],
  closureEvents: [{ id: "new", assignment_id: "a" }],
  inspections: [
    {
      id: "inspection",
      accommodation_id: "site",
      assignment_id: "a",
      winter_close_event_id: "new",
    },
  ],
  decisions: [{ inspection_id: "inspection", decision: "approved" }],
  availability: { items: [{ accommodationId: "site", blockers: [] }] },
};
const run = (changes = {}) =>
  reconcileSpringOwnerReview({ ...input, ...changes })[0];

test("approved inspection with clear snapshot is advisory, never an opening", () => {
  assert.equal(run().reviewState, "ready_for_owner_review");
  assert.deepEqual(run().blockers, []);
});
test("latest winter closure supersedes previous approval", () => {
  assert.deepEqual(
    run({ closureEvents: [{ id: "later", assignment_id: "a" }] }).blockers,
    ["spring_evidence_not_approved"],
  );
});
test("independent operational blocks survive spring approval", () => {
  const item = run({
    availability: {
      items: [
        {
          accommodationId: "site",
          blockers: ["management_restriction", "turnover"],
        },
      ],
    },
    assignments: [
      { ...input.assignments[0], occupancy_state: "winter_closed" },
    ],
  });
  assert.deepEqual(item.blockers, [
    "winter_closed_assignment",
    "management_restriction",
    "turnover",
  ]);
  assert.equal(item.reviewState, "requires_review");
});
test("missing snapshot and inactive synthetic campground fail closed", () => {
  assert.deepEqual(
    run({ campgroundActive: false, availability: null }).blockers,
    ["inactive_campground", "availability_not_verified"],
  );
});
