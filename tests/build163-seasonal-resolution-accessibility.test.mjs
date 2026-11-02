import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeSeasonalTrends } from "../lib/command-centre/seasonal-trends-core.mjs";
import { buildCamperResolutionTimeline } from "../lib/command-centre/resolution-timeline-core.mjs";

const months = [
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
  "2026-09-01",
  "2026-10-01",
];
function trendRows(overrides = {}) {
  return months.map((month) => ({
    month,
    siteNights: 100,
    bookedNights: 40,
    seasonalNights: 20,
    reservationNights: 30,
    ...overrides,
  }));
}
function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Build 163 seasonal analytics computes site-night weighted coverage, including overlap", () => {
  const result = summarizeSeasonalTrends(trendRows());
  assert.equal(result.months.length, 6);
  assert.equal(result.siteNights, 600);
  assert.equal(result.bookedNights, 240);
  assert.equal(result.seasonalNights, 120);
  assert.equal(result.reservationNights, 180);
  assert.equal(result.averageBookedPercent, 40);
  assert.equal(result.months[0].seasonalPercent, 20);
});

test("Build 163 reports legitimate zero inventory but rejects missing or impossible periods", () => {
  assert.equal(
    summarizeSeasonalTrends(
      trendRows({
        siteNights: 0,
        bookedNights: 0,
        seasonalNights: 0,
        reservationNights: 0,
      }),
    ).averageBookedPercent,
    0,
  );
  assert.throws(() => summarizeSeasonalTrends([]), /six monthly/);
  assert.throws(
    () => summarizeSeasonalTrends(trendRows({ bookedNights: 101 })),
    /Impossible/,
  );
  assert.throws(
    () => summarizeSeasonalTrends(trendRows({ seasonalNights: -1 })),
    /Invalid/,
  );
  const gap = trendRows();
  gap[2].month = "2026-07-04";
  assert.throws(
    () => summarizeSeasonalTrends(gap),
    /Invalid utilization period/,
  );
});

const cases = [
  {
    id: "case-01",
    accommodationCode: "A-10",
    summary: "Water pressure",
    severity: "urgent",
    caseState: "closed",
    assignedToLabel: "Staff Member",
    outcomeCode: "resolved",
    submittedAt: "2026-10-25T10:00:00.000Z",
    updatedAt: "2026-10-26T10:00:00.000Z",
    closedAt: "2026-10-26T10:00:00.000Z",
    events: [
      {
        id: "event-02",
        eventKind: "closed",
        occurredAt: "2026-10-26T10:00:00.000Z",
        summary: "Resolved pressure",
        actorLabel: "Staff Member",
        sourceChannel: "staff",
      },
      {
        id: "event-01",
        eventKind: "triaged",
        occurredAt: "2026-10-25T11:00:00.000Z",
        summary: "Reviewed",
        actorLabel: "Staff Member",
        sourceChannel: "web",
      },
    ],
  },
  {
    id: "case-02",
    accommodationCode: "B-11",
    summary: "Gate access",
    severity: "urgent",
    caseState: "assigned",
    assignedToLabel: null,
    outcomeCode: null,
    submittedAt: "2026-10-30T10:00:00.000Z",
    updatedAt: "2026-10-30T13:00:00.000Z",
    closedAt: null,
    events: [],
  },
];

test("Build 163 camper timeline uses actual events and only measured closure durations", () => {
  const result = buildCamperResolutionTimeline(
    cases,
    new Date("2026-10-31T00:00:00Z"),
  );
  assert.equal(result.count, 2);
  assert.equal(result.closedCount, 1);
  assert.equal(result.unresolvedCount, 1);
  assert.equal(result.urgentOpenCount, 1);
  assert.equal(result.averageResolutionHours, 24);
  assert.equal(result.measuredClosures, 1);
  assert.equal(result.closedWithEvidenceCount, 1);
  assert.deepEqual(
    result.entries
      .find((entry) => entry.id === "case-01")
      .events.map((event) => event.kind),
    ["triaged", "closed"],
  );
});

test("Build 163 missing closure timestamps and evidence never become zero-hour outcomes", () => {
  const incomplete = { ...cases[0], closedAt: null, events: [] };
  const result = buildCamperResolutionTimeline([incomplete]);
  assert.equal(result.averageResolutionHours, null);
  assert.equal(result.closedWithEvidenceCount, 0);
  assert.equal(result.entries[0].durationHours, null);
  assert.equal(result.entries[0].closureEventPresent, false);
  assert.throws(() => buildCamperResolutionTimeline(null), /unavailable/);
});

test("Build 163 seasonal SQL is scoped, read-only, RLS-authorized and bounded to history", () => {
  const code = source("../lib/command-centre/occupancy-postgres.mjs");
  assert.match(code, /getCampgroundSeasonalTrends/);
  assert.match(code, /reports\.read/);
  assert.match(code, /reservation\.read/);
  assert.match(code, /accommodation\.read/);
  assert.match(code, /begin read only/);
  assert.match(code, /set local role icamp_app/);
  assert.match(code, /set_config\('icamp\.user_id'/);
  assert.match(code, /s\.campground_id=\$1/);
  assert.match(code, /r\.campground_id=\$1/);
  assert.match(code, /status in \('confirmed','checked_in','completed'\)/);
  assert.match(code, /s\.assignment_state in \('active','ended'\)/);
  assert.match(code, /last_date-m\.first_date/);
});

test("Build 163 resolution route reuses authenticated source with no messaging or writes", () => {
  const page = source(
    "../app/workspaces/management/command/resolutions/page.tsx",
  );
  assert.match(page, /requireStaff/);
  assert.match(page, /getCampgroundAuthorization/);
  assert.match(page, /reports\.read/);
  assert.match(page, /listAssistanceQueue/);
  assert.match(page, /buildCamperResolutionTimeline/);
  assert.doesNotMatch(
    page,
    /recordAssistanceGuestMessageAction|sendSms|sendEmail/,
  );
});

test("Build 163 Standard theme accessibility controls are keyboard-operable and local only", () => {
  const controls = source("../components/standard-accessibility-controls.tsx");
  const theme = source("../app/standard-theme.css");
  assert.match(controls, /aria-pressed=\{contrast\}/);
  assert.match(controls, /aria-pressed=\{motion\}/);
  assert.match(controls, /localStorage/);
  assert.match(theme, /:focus-visible/);
  assert.match(theme, /prefers-reduced-motion/);
  assert.match(theme, /data-icamp-contrast/);
  assert.match(theme, /data-icamp-motion/);
  assert.doesNotMatch(controls, /fetch\(|POST|save[A-Z]/);
});

test("Build 163 theme review links to both real screens and retains nonapproval disclosure", () => {
  const review = source("../components/standard-theme-owner-review.tsx");
  const shell = source("../components/app-shell.tsx");
  assert.match(review, /command\/seasonal/);
  assert.match(review, /command\/resolutions/);
  assert.match(review, /not a stored approval/);
  assert.match(shell, /StandardAccessibilityControls/);
  assert.match(shell, /Skip to main content/);
});
