import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createSavedForecastBackup,
  exportSavedForecastComparisonCsv,
  recoverSavedForecastBackup,
  upsertSavedForecastView,
} from "../lib/command-centre/forecast-saved-views-core.mjs";
import { summarizeEscalationAging } from "../lib/command-centre/escalation-aging-core.mjs";
import { captureEscalationRecheckReceipt } from "../lib/command-centre/escalation-recheck-receipts-core.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Build 168 backs up only saved filters and recovers only in the same signed-in scope", () => {
  const scope = { userId: "staff-a", campgroundId: "camp-a" };
  const views = upsertSavedForecastView([], {
    label: "High five months",
    lookbackMonths: 5,
    scenario: "high",
  });
  const backup = createSavedForecastBackup(views, scope);
  assert.deepEqual(recoverSavedForecastBackup(backup, scope), views);
  assert.doesNotMatch(backup, /bookedNights|expectedNights|capacity|guest/);
  assert.throws(
    () =>
      recoverSavedForecastBackup(backup, {
        userId: "staff-b",
        campgroundId: "camp-a",
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      recoverSavedForecastBackup(backup, {
        userId: "staff-a",
        campgroundId: "camp-b",
      }),
    /does not match/,
  );
  assert.throws(
    () => recoverSavedForecastBackup("not json", scope),
    /not valid JSON/,
  );
  assert.throws(
    () => recoverSavedForecastBackup("x".repeat(8001), scope),
    /8 KB/,
  );
  const duplicated = JSON.parse(backup);
  duplicated.views.push(duplicated.views[0]);
  assert.throws(
    () => recoverSavedForecastBackup(JSON.stringify(duplicated), scope),
    /repeated/,
  );
  const tampered = JSON.parse(backup);
  tampered.views[0].scenario = "imaginary";
  assert.throws(
    () => recoverSavedForecastBackup(JSON.stringify(tampered), scope),
    /invalid/,
  );
});

test("Build 168 comparison CSV uses fresh source values and neutralizes spreadsheet formulas", () => {
  const views = upsertSavedForecastView([], {
    label: '=HYPERLINK("bad")',
    lookbackMonths: 2,
    scenario: "low",
  });
  const csv = exportSavedForecastComparisonCsv(views, [
    {
      lookbackMonths: 2,
      scenario: "low",
      generatedAt: "2026-10-31T15:00:00.000Z",
      total: {
        actualBookedNights: 15,
        expectedNights: 10,
        varianceNights: 5,
        comparableKinds: 2,
        excludedKinds: 1,
      },
    },
  ]);
  assert.match(csv, /'\=HYPERLINK/);
  assert.match(csv, /"2026-10-31T15:00:00.000Z"/);
  assert.match(csv, /"15","10","5","2","1"/);
  assert.match(csv, /not future demand or authorization/);
  assert.equal(csv.trim().split("\r\n").length, 2);
  const missing = exportSavedForecastComparisonCsv(views, []);
  assert.match(missing, /Unavailable/);
});

function sampleCase(state, acknowledgedAt) {
  return [
    {
      id: "case-a",
      accommodationCode: "A-15",
      summary: "Source check",
      caseState: "escalated",
      severity: "routine",
      assignedToLabel: "Manager",
      escalations: [
        {
          id: "event-a",
          state,
          escalationLevel: "manager",
          raisedAt: "2026-10-31T08:00:00.000Z",
          acknowledgedAt,
        },
      ],
    },
  ];
}

test("Build 168 recheck receipt distinguishes new source snapshots and never invents an acknowledgment", () => {
  const initial = summarizeEscalationAging(
    sampleCase("acknowledged", null),
    new Date("2026-10-31T09:00:00.000Z"),
  );
  const first = captureEscalationRecheckReceipt(
    initial,
    "event-a",
    new Date("2026-10-31T09:10:00.000Z"),
  );
  assert.equal(first.status, "missing_timestamp");
  assert.equal(first.change, "baseline");
  assert.equal(first.previousStatus, null);
  assert.throws(
    () =>
      captureEscalationRecheckReceipt(
        initial,
        "event-a",
        new Date("2026-10-31T09:12:00.000Z"),
        first,
      ),
    /Refresh the source/,
  );
  const updated = summarizeEscalationAging(
    sampleCase("acknowledged", "2026-10-31T08:20:00.000Z"),
    new Date("2026-10-31T10:00:00.000Z"),
  );
  const second = captureEscalationRecheckReceipt(
    updated,
    "event-a",
    new Date("2026-10-31T10:01:00.000Z"),
    first,
  );
  assert.equal(second.previousStatus, "missing_timestamp");
  assert.equal(second.status, "recorded");
  assert.equal(second.change, "changed");
  assert.equal(second.sourceObservedAt, updated.generatedAt);
  assert.throws(
    () => captureEscalationRecheckReceipt(updated, "unseen"),
    /not present/,
  );
  const same = summarizeEscalationAging(
    sampleCase("acknowledged", "2026-10-31T08:20:00.000Z"),
    new Date("2026-10-31T11:00:00.000Z"),
  );
  assert.equal(
    captureEscalationRecheckReceipt(
      same,
      "event-a",
      new Date("2026-10-31T11:01:00.000Z"),
      second,
    ).change,
    "unchanged",
  );
});

test("Build 168 UI recovery, recheck readback and accessibility summary preserve source guards and manual evidence boundaries", () => {
  const forecast = source("../components/forecast-saved-views.tsx");
  const forecastPage = source(
    "../app/workspaces/management/command/forecast/page.tsx",
  );
  const board = source("../components/camper-escalation-aging-board.tsx");
  const page = source(
    "../app/workspaces/management/command/escalations/page.tsx",
  );
  const review = source("../components/standard-theme-owner-review.tsx");
  const css = source("../app/standard-theme.css");
  assert.match(forecast, /Download preference backup/);
  assert.match(forecast, /Confirm local restore/);
  assert.match(forecast, /Export current comparison CSV/);
  assert.match(forecast, /recoverSavedForecastBackup/);
  assert.match(forecastPage, /requireStaff|getCampgroundAuthorization/);
  assert.match(board, /router\.refresh\(\)/);
  assert.match(board, /Capture refreshed source/);
  assert.match(board, /Copy local recheck receipts/);
  assert.match(board, /not independent closure proof/);
  assert.match(page, /listAssistanceQueue/);
  assert.match(review, /Accessibility retest summary/);
  assert.match(review, /accessibilityResults/);
  assert.match(review, /version: 2/);
  assert.match(review, /\[1, 2\]\.includes/);
  assert.match(review, /not automated WCAG certification/);
  assert.match(css, /camp-theme-review__accessibility-grid/);
  assert.doesNotMatch(
    forecast + board + review,
    /sendSms|sendEmail|createCharge|acknowledgeAssistanceEscalationAction/,
  );
});
