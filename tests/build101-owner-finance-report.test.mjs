import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeWindow,
  authorizedOwnerCampgrounds,
  summarizeOwnerPortfolio,
  aggregateWeeklyActivity,
} from "../lib/permanent-unit-owner-report/core.mjs";
test("cross-campground reporting refuses a non-owner assignment or missing finance permission", () => {
  const assignments = [
    { campgroundId: "camp-a", roleCodes: ["owner_admin"], allowed: true },
    { campgroundId: "camp-b", roleCodes: ["detailer"], allowed: true },
    { campgroundId: "camp-c", roleCodes: ["owner_admin"], allowed: false },
  ];
  assert.deepEqual(
    authorizedOwnerCampgrounds(assignments).map((a) => a.campgroundId),
    ["camp-a"],
  );
  assert.equal(normalizeWindow("7"), 7);
  assert.equal(normalizeWindow("90"), 90);
  assert.equal(normalizeWindow("999"), 30);
});
test("risk-neutral report keeps independent current state and activity-window counters", () => {
  const a = {
    currentHolds: 2,
    openTasks: 3,
    overdueTasks: 1,
    recurrentConsents: 1,
    newConsents: 4,
    newHolds: 2,
    clearedHolds: 1,
    createdTasks: 3,
    closedTasks: 2,
    recurrenceReviews: 1,
  };
  const b = {
    currentHolds: 0,
    openTasks: 1,
    overdueTasks: 0,
    recurrentConsents: 0,
    newConsents: 2,
    newHolds: 0,
    clearedHolds: 2,
    createdTasks: 1,
    closedTasks: 1,
    recurrenceReviews: 0,
  };
  assert.deepEqual(summarizeOwnerPortfolio([a, b]), {
    campgrounds: 2,
    currentHolds: 2,
    openTasks: 4,
    overdueTasks: 1,
    recurrentConsents: 1,
    newConsents: 6,
    newHolds: 2,
    clearedHolds: 3,
    createdTasks: 4,
    closedTasks: 3,
    recurrenceReviews: 1,
  });
  const weeks = ["2026-10-05", "2026-10-12"];
  const w = aggregateWeeklyActivity(
    [
      {
        weeks: [
          {
            week: weeks[0],
            consents: 2,
            holds: 1,
            clears: 0,
            createdTasks: 2,
            closedTasks: 0,
          },
        ],
      },
      {
        weeks: [
          {
            week: weeks[0],
            consents: 3,
            holds: 0,
            clears: 2,
            createdTasks: 1,
            closedTasks: 1,
          },
          { week: "2026-09-14", consents: 100 },
        ],
      },
    ],
    weeks,
  );
  assert.deepEqual(w, [
    {
      week: weeks[0],
      consents: 5,
      holds: 1,
      clears: 2,
      createdTasks: 3,
      closedTasks: 1,
    },
    {
      week: weeks[1],
      consents: 0,
      holds: 0,
      clears: 0,
      createdTasks: 0,
      closedTasks: 0,
    },
  ]);
});
test("owner report is read-only, independently scoped and contains no applicant details", () => {
  const code = readFileSync(
    new URL("../lib/permanent-unit-owner-report/postgres.mjs", import.meta.url),
    "utf8",
  );
  for (const expected of [
    "owner_admin",
    "permanent_unit.transfer",
    "set local role icamp_app",
    "set local time zone 'UTC'",
    "begin read only",
    "getCampgroundAuthorization",
    "organization_id=$2",
  ])
    assert.ok(code.includes(expected), expected);
  for (const forbidden of [
    "buyer_display_name",
    "credit_score",
    "bank_account",
    "social_insurance_number",
    "insert into",
    "update public.",
    "delete from",
  ])
    assert.equal(code.toLowerCase().includes(forbidden), false, forbidden);
});
