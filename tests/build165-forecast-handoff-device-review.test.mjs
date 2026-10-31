import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeCapacityForecastVariance } from "../lib/command-centre/capacity-forecast-core.mjs";
import {
  summarizeEscalationAging,
  summarizeAcknowledgementHandoff,
} from "../lib/command-centre/escalation-aging-core.mjs";
import { summarizeSegmentComparisons } from "../lib/command-centre/segment-comparison-core.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const months = [
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
  "2026-09-01",
  "2026-10-01",
];
const kinds = ["campsite", "rental_cottage", "permanent_unit"];
const rows = () =>
  months.flatMap((month, index) =>
    kinds.map((kind) => ({
      month,
      kind,
      siteNights: index === 5 ? 20 : 100,
      bookedNights: index === 5 ? 15 : 50,
      seasonalNights: index === 5 ? 10 : 30,
      reservationNights: index === 5 ? 10 : 30,
    })),
  );

test("Build 165 compares current month to completed three-month weighted historical rate", () => {
  const original = summarizeSegmentComparisons(
    rows(),
    new Date("2026-10-31T12:00:00Z"),
  );
  const report = summarizeCapacityForecastVariance(original);
  assert.deepEqual(report.baselineMonths, months.slice(2, 5));
  assert.equal(report.currentMonth, months[5]);
  assert.equal(report.rows[0].baselineSiteNights, 300);
  assert.equal(report.rows[0].baselineBookedNights, 150);
  assert.equal(report.rows[0].baselinePercent, 50);
  assert.equal(report.rows[0].actualBookedNights, 15);
  assert.equal(report.rows[0].expectedNights, 10);
  assert.equal(report.rows[0].varianceNights, 5);
  assert.equal(report.rows[0].variancePoints, 25);
  assert.equal(report.total.actualBookedNights, 45);
  assert.equal(report.total.expectedNights, 30);
  assert.equal(report.total.varianceNights, 15);
  assert.equal(report.total.excludedKinds, 0);
});

test("Build 165 never calls absent historical inventory a zero-rate forecast", () => {
  const input = rows();
  for (const row of input)
    if (row.kind === "rental_cottage" && row.month !== "2026-10-01") {
      row.siteNights = 0;
      row.bookedNights = 0;
      row.seasonalNights = 0;
      row.reservationNights = 0;
    }
  const report = summarizeCapacityForecastVariance(
    summarizeSegmentComparisons(input),
  );
  const missing = report.rows.find((row) => row.kind === "rental_cottage");
  assert.equal(missing.reason, "no_baseline_inventory");
  assert.equal(missing.expectedNights, null);
  assert.equal(missing.varianceNights, null);
  assert.equal(report.total.excludedKinds, 1);
  assert.equal(report.total.actualBookedNights, 30);
  assert.throws(() => summarizeCapacityForecastVariance({}), /six-month/);
});

test("Build 165 uses current month-to-date site nights, not a full-month future prediction", () => {
  const input = rows();
  for (const row of input)
    if (row.kind === "permanent_unit" && row.month === "2026-10-01") {
      row.siteNights = 0;
      row.bookedNights = 0;
      row.seasonalNights = 0;
      row.reservationNights = 0;
    }
  const report = summarizeCapacityForecastVariance(
    summarizeSegmentComparisons(input),
  );
  const missing = report.rows.find((row) => row.kind === "permanent_unit");
  assert.equal(missing.reason, "no_current_inventory");
  assert.equal(missing.actualBookedNights, 0);
  assert.equal(report.total.comparableKinds, 2);
  assert.equal(report.total.varianceNights, 10);
});

test("Build 165 acknowledgment handoff reports only open source escalations", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const cases = [
    {
      id: "urgent",
      accommodationCode: "A",
      summary: "Please help",
      severity: "urgent",
      caseState: "escalated",
      assignedToLabel: null,
      escalations: [
        {
          id: "e-1",
          escalationLevel: "manager",
          state: "open",
          raisedAt: "2026-10-29T11:00:00Z",
          acknowledgedAt: null,
        },
      ],
    },
    {
      id: "acknowledged",
      accommodationCode: "B",
      summary: "Another issue",
      severity: "routine",
      caseState: "escalated",
      assignedToLabel: "Manager",
      escalations: [
        {
          id: "e-2",
          escalationLevel: "owner",
          state: "acknowledged",
          raisedAt: "2026-10-20T11:00:00Z",
          acknowledgedAt: "2026-10-20T12:00:00Z",
        },
      ],
    },
    {
      id: "unknown",
      accommodationCode: "C",
      summary: "Unknown time",
      severity: "routine",
      caseState: "escalated",
      assignedToLabel: "Manager",
      escalations: [
        {
          id: "e-3",
          escalationLevel: "manager",
          state: "open",
          raisedAt: null,
          acknowledgedAt: null,
        },
      ],
    },
  ];
  const summary = summarizeEscalationAging(cases, now);
  assert.deepEqual(summarizeAcknowledgementHandoff(summary), {
    pendingCount: 2,
    urgentCount: 1,
    attentionCount: 1,
    unknownAgeCount: 1,
    unassignedCount: 1,
    ambiguousCount: 0,
  });
  assert.throws(() => summarizeAcknowledgementHandoff(null), /unavailable/);
});

test("Build 165 forecast and triage routes remain permission scoped and read-only", () => {
  const page = source("../app/workspaces/management/command/forecast/page.tsx");
  const board = source("../components/camper-escalation-aging-board.tsx");
  const management = source("../app/workspaces/management/command/page.tsx");
  for (const permission of [
    "reports.read",
    "reservation.read",
    "accommodation.read",
  ])
    assert.match(page, new RegExp(permission.replace(".", "\\.")));
  assert.match(page, /requireStaff/);
  assert.match(page, /getCampgroundAuthorization/);
  assert.match(page, /getCampgroundSegmentComparison/);
  assert.match(page, /Read-only/);
  assert.match(page, /HELD \/ DISCONNECTED/);
  assert.match(management, /command\/forecast/);
  assert.match(board, /Open triage to acknowledge/);
  assert.match(board, /assistance\?campground=/);
  assert.match(board, /handoff is not proof/);
  assert.doesNotMatch(page + board, /createCharge|sendSms|sendEmail/);
});

test("Build 165 owner review records desktop, tablet and phone observations, not approval", () => {
  const review = source("../components/standard-theme-owner-review.tsx");
  const css = source("../app/standard-theme.css");
  const route = source("../app/settings/themes/acceptance/page.tsx");
  for (const label of [
    "Desktop / laptop",
    "Tablet",
    "Phone",
    "Not yet tested",
    "Needs correction",
  ])
    assert.ok(review.includes(label), label);
  assert.match(review, /command\/forecast/);
  assert.match(review, /self-reported; not automatically verified/);
  assert.match(route, /Cross-Device Review/);
  assert.match(css, /camp-device-review__grid/);
  assert.match(css, /max-width: 48rem/);
});
