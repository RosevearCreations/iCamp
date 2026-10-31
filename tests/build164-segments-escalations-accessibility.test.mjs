import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeSegmentComparisons } from "../lib/command-centre/segment-comparison-core.mjs";
import { summarizeEscalationAging } from "../lib/command-centre/escalation-aging-core.mjs";

const months = [
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
  "2026-09-01",
  "2026-10-01",
];
const kinds = ["campsite", "rental_cottage", "permanent_unit"];
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const rows = () =>
  months.flatMap((month) =>
    kinds.map((kind) => ({
      month,
      kind,
      siteNights: 100,
      bookedNights: 55,
      seasonalNights: 35,
      reservationNights: 30,
    })),
  );

test("Build 164 segment comparison is weighted by site nights and deduplicates overlapping coverage", () => {
  const result = summarizeSegmentComparisons(rows());
  assert.deepEqual(result.months, months);
  assert.deepEqual(
    result.segments.map((item) => item.kind),
    kinds,
  );
  assert.equal(result.segments[0].siteNights, 600);
  assert.equal(result.segments[0].bookedNights, 330);
  assert.equal(result.segments[0].bookedPercent, 55);
  assert.equal(result.segments[1].months.length, 6);
});

test("Build 164 actual empty inventory is zero, but incomplete or impossible data fails closed", () => {
  assert.equal(
    summarizeSegmentComparisons(
      rows().map((item) => ({
        ...item,
        siteNights: 0,
        bookedNights: 0,
        seasonalNights: 0,
        reservationNights: 0,
      })),
    ).segments[0].bookedPercent,
    0,
  );
  assert.throws(() => summarizeSegmentComparisons([]), /six months/);
  assert.throws(
    () => summarizeSegmentComparisons(rows().slice(1)),
    /six months/,
  );
  assert.throws(
    () =>
      summarizeSegmentComparisons(
        rows().map((item, i) =>
          i === 1 ? { ...item, month: "2026-05-01", kind: "campsite" } : item,
        ),
      ),
    /Duplicate/,
  );
  assert.throws(
    () =>
      summarizeSegmentComparisons(
        rows().map((item) => ({ ...item, bookedNights: 101 })),
      ),
    /Impossible/,
  );
  assert.throws(
    () =>
      summarizeSegmentComparisons(
        rows().map((item) => ({ ...item, seasonalNights: -1 })),
      ),
    /Invalid/,
  );
  const gap = rows();
  for (const row of gap)
    if (row.month === "2026-07-01") row.month = "2026-11-01";
  assert.throws(() => summarizeSegmentComparisons(gap), /consecutive/);
});

function escalation(id, hours, state = "open", severity = "routine") {
  return {
    id,
    accommodationCode: `S-${id}`,
    summary: `Guest request ${id}`,
    severity,
    caseState: "escalated",
    assignedToLabel: "Team member",
    escalations: [
      {
        id: `e-${id}`,
        escalationLevel: "manager",
        state,
        raisedAt:
          hours === null
            ? null
            : new Date(
                Date.UTC(2026, 9, 31, 12) - hours * 3_600_000,
              ).toISOString(),
        acknowledgedAt: null,
      },
    ],
  };
}

test("Build 164 aging uses real raised timestamps and preserves acknowledged cases as active", () => {
  const queue = [
    escalation("fresh", 23),
    escalation("day", 25),
    escalation("long", 80, "acknowledged", "urgent"),
  ];
  const result = summarizeEscalationAging(
    queue,
    new Date("2026-10-31T12:00:00Z"),
  );
  assert.equal(result.activeCount, 3);
  assert.equal(result.awaitingAcknowledgement, 2);
  assert.equal(result.awaitingResolution, 1);
  assert.equal(result.over24Hours, 2);
  assert.equal(result.over72Hours, 1);
  assert.equal(result.urgentActive, 1);
  assert.equal(result.items[0].caseId, "long");
  assert.equal(result.items[0].ageHours, 80);
});

test("Build 164 missing timestamps and concurrent active escalations are flagged, never guessed", () => {
  const double = escalation("double", null);
  double.escalations.push({
    ...double.escalations[0],
    id: "e-later",
    state: "acknowledged",
  });
  const resolved = escalation("resolved", 9, "resolved");
  const result = summarizeEscalationAging(
    [double, resolved],
    new Date("2026-10-31T12:00:00Z"),
  );
  assert.equal(result.activeCount, 1);
  assert.equal(result.unknownAge, 1);
  assert.equal(result.multipleActive, 1);
  assert.equal(result.items[0].ageHours, null);
  assert.throws(() => summarizeEscalationAging(null), /unavailable/);
});

test("Build 164 segment SQL is RLS-aware, read-only and honors every real accommodation category", () => {
  const code = source("../lib/command-centre/segment-comparison-postgres.mjs");
  for (const permission of [
    "reports.read",
    "reservation.read",
    "accommodation.read",
  ])
    assert.match(code, new RegExp(permission.replace(".", "\\.")));
  for (const kind of kinds) assert.match(code, new RegExp(kind));
  assert.match(code, /begin read only/);
  assert.match(code, /set local role icamp_app/);
  assert.match(code, /set_config\('icamp\.user_id'/);
  assert.match(code, /s\.campground_id=\$1/);
  assert.match(code, /r\.campground_id=\$1/);
  assert.match(code, /a\.campground_id=\$1/);
  assert.match(code, /statement_timestamp\(\) at time zone/);
  assert.doesNotMatch(code, /\b(insert|update|delete)\s+public\./i);
});

test("Build 164 both new screens require a staff session and explicitly check campground access", () => {
  const segments = source(
    "../app/workspaces/management/command/segments/page.tsx",
  );
  const escalations = source(
    "../app/workspaces/management/command/escalations/page.tsx",
  );
  for (const page of [segments, escalations]) {
    assert.match(page, /requireStaff/);
    assert.match(page, /getCampgroundAuthorization/);
    assert.match(page, /reports\.read/);
    assert.match(page, /read-only|Read-only/);
    assert.doesNotMatch(page, /sendSms|sendEmail|createCharge/);
  }
  assert.match(segments, /getCampgroundSegmentComparison/);
  assert.match(escalations, /listAssistanceQueue/);
  assert.match(escalations, /summarizeEscalationAging/);
});

test("Build 164 filters, real triage handoff, and the 3-month card totals agree with visible months", () => {
  const board = source("../components/camper-escalation-aging-board.tsx");
  const chart = source("../components/segment-comparison-chart.tsx");
  assert.match(board, /24\+ hours/);
  assert.match(board, /72\+ hours/);
  assert.match(board, /assistance\?campground=/);
  assert.match(board, /aria-live="polite"/);
  assert.match(chart, /summary\.months\.slice\(-range\)/);
  assert.match(chart, /months\.includes\(row\.month\)/);
  assert.match(chart, /selected\.reduce/);
  assert.match(chart, /aria-pressed/);
});

test("Build 164 Standard accessibility uses a keyboard-closeable local text/contrast/motion preference panel", () => {
  const controls = source("../components/standard-accessibility-controls.tsx");
  const stylesheet = source("../app/standard-theme.css");
  const review = source("../components/standard-theme-owner-review.tsx");
  assert.match(controls, /Larger text/);
  assert.match(controls, /Escape/);
  assert.match(controls, /aria-pressed=\{largeText\}/);
  assert.match(controls, /localStorage/);
  assert.match(stylesheet, /data-icamp-text="large"/);
  assert.match(stylesheet, /:focus-visible/);
  assert.match(stylesheet, /prefers-reduced-motion/);
  assert.match(review, /command\/segments/);
  assert.match(review, /command\/escalations/);
  assert.match(review, /not a stored approval/);
});
