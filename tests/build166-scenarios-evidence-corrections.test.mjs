import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FORECAST_SCENARIOS,
  FORECAST_WINDOWS,
  summarizeCapacityForecastVariance,
} from "../lib/command-centre/capacity-forecast-core.mjs";
import {
  summarizeAcknowledgementEvidence,
  summarizeEscalationAging,
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

function sampleSegments() {
  return summarizeSegmentComparisons(
    months.flatMap((month, index) =>
      kinds.map((kind) => ({
        month,
        kind,
        siteNights: index === 5 ? 20 : 100,
        bookedNights: index === 5 ? 14 : [20, 30, 40, 60, 80][index],
        seasonalNights: index === 5 ? 8 : [10, 20, 30, 40, 50][index],
        reservationNights: index === 5 ? 8 : [10, 10, 10, 20, 30][index],
      })),
    ),
    new Date("2026-10-31T12:00:00Z"),
  );
}

test("Build 166 offers 2/3/5 month low/weighted/high observed-rate scenarios", () => {
  assert.deepEqual(FORECAST_WINDOWS, [2, 3, 5]);
  assert.deepEqual(FORECAST_SCENARIOS, ["low", "weighted", "high"]);
  const data = sampleSegments();
  const low = summarizeCapacityForecastVariance(data, {
    lookbackMonths: 3,
    scenario: "low",
  });
  const weighted = summarizeCapacityForecastVariance(data);
  const high = summarizeCapacityForecastVariance(data, {
    lookbackMonths: 3,
    scenario: "high",
  });
  assert.deepEqual(low.baselineMonths, months.slice(2, 5));
  assert.equal(low.rows[0].baselinePercent, 40);
  assert.equal(weighted.rows[0].baselinePercent, 60);
  assert.equal(high.rows[0].baselinePercent, 80);
  assert.equal(low.rows[0].expectedNights, 8);
  assert.equal(weighted.rows[0].expectedNights, 12);
  assert.equal(high.rows[0].expectedNights, 16);
  assert.equal(low.rows[0].varianceNights, 6);
  assert.equal(high.rows[0].varianceNights, -2);
  const short = summarizeCapacityForecastVariance(data, {
    lookbackMonths: 2,
    scenario: "low",
  });
  const long = summarizeCapacityForecastVariance(data, {
    lookbackMonths: 5,
    scenario: "weighted",
  });
  assert.equal(short.rows[0].baselinePercent, 60);
  assert.equal(long.rows[0].baselinePercent, 46);
  assert.equal(short.lookbackMonths, 2);
  assert.equal(long.lookbackMonths, 5);
  assert.throws(
    () => summarizeCapacityForecastVariance(data, { lookbackMonths: 4 }),
    /Unsupported/,
  );
  assert.throws(
    () => summarizeCapacityForecastVariance(data, { scenario: "invented" }),
    /Unsupported/,
  );
});

test("Build 166 low/high scenarios exclude missing baseline inventory rather than inventing rates", () => {
  const data = sampleSegments();
  const cottage = data.segments.find(
    (segment) => segment.kind === "rental_cottage",
  );
  for (const row of cottage.months.slice(0, -1)) {
    row.siteNights = 0;
    row.bookedNights = 0;
  }
  for (const scenario of ["low", "weighted", "high"]) {
    const result = summarizeCapacityForecastVariance(data, {
      lookbackMonths: 5,
      scenario,
    });
    const row = result.rows.find((item) => item.kind === "rental_cottage");
    assert.equal(row.reason, "no_baseline_inventory");
    assert.equal(row.expectedNights, null);
    assert.equal(result.total.excludedKinds, 1);
  }
});

function caseRecord(id, state, raisedAt, acknowledgedAt) {
  return {
    id,
    accommodationCode: `A-${id}`,
    summary: `Escalation ${id}`,
    caseState: "escalated",
    severity: "routine",
    assignedToLabel: "Manager",
    escalations: [
      {
        id: `e-${id}`,
        escalationLevel: "manager",
        state,
        raisedAt,
        acknowledgedAt,
        raisedByLabel: "Front desk",
      },
    ],
  };
}

test("Build 166 evidence readback distinguishes timestamp proof from gaps and source conflicts", () => {
  const at = new Date("2026-10-31T12:00:00Z");
  const cases = [
    caseRecord(
      "recorded",
      "acknowledged",
      "2026-10-30T08:00:00Z",
      "2026-10-30T10:00:00Z",
    ),
    caseRecord("pending", "open", "2026-10-29T08:00:00Z", null),
    caseRecord("missing", "acknowledged", "2026-10-30T08:00:00Z", null),
    caseRecord(
      "before",
      "acknowledged",
      "2026-10-30T08:00:00Z",
      "2026-10-29T10:00:00Z",
    ),
    caseRecord(
      "future",
      "acknowledged",
      "2026-10-30T08:00:00Z",
      "2026-11-01T10:00:00Z",
    ),
    caseRecord("sequence", "acknowledged", null, "2026-10-30T10:00:00Z"),
    caseRecord(
      "conflict",
      "open",
      "2026-10-30T08:00:00Z",
      "2026-10-30T10:00:00Z",
    ),
  ];
  const evidence = summarizeAcknowledgementEvidence(
    summarizeEscalationAging(cases, at),
  );
  const lookup = Object.fromEntries(
    evidence.records.map((item) => [item.caseId, item.status]),
  );
  assert.deepEqual(lookup, {
    recorded: "recorded",
    pending: "pending",
    missing: "missing_timestamp",
    before: "invalid_timestamp",
    future: "invalid_timestamp",
    sequence: "sequence_unknown",
    conflict: "state_conflict",
  });
  assert.equal(evidence.recordedCount, 1);
  assert.equal(evidence.pendingCount, 1);
  assert.equal(evidence.gapCount, 5);
  assert.throws(() => summarizeAcknowledgementEvidence(null), /unavailable/);
});

test("Build 166 authenticated report filters and readback remain bounded to original source", () => {
  const page = source("../app/workspaces/management/command/forecast/page.tsx");
  const core = source("../lib/command-centre/capacity-forecast-core.mjs");
  const board = source("../components/camper-escalation-aging-board.tsx");
  const escalationPage = source(
    "../app/workspaces/management/command/escalations/page.tsx",
  );
  assert.match(page, /requireStaff/);
  assert.match(page, /getCampgroundAuthorization/);
  assert.match(page, /getCampgroundSegmentComparison/);
  assert.match(page, /Historical scenario/);
  assert.match(page, /FORECAST_SCENARIOS|scenario === "low"/);
  assert.match(page, /name="campground"/);
  assert.match(core, /FORECAST_WINDOWS/);
  assert.match(core, /monthlyRates/);
  assert.match(board, /summarizeAcknowledgementEvidence/);
  assert.match(board, /Show evidence gaps/);
  assert.match(board, /Source escalation/);
  assert.match(escalationPage, /listAssistanceQueue/);
  assert.match(board, /independent witness receipt/);
  assert.doesNotMatch(
    page + board,
    /sendSms|sendEmail|createCharge|acknowledgeAssistanceEscalationAction/,
  );
});

test("Build 166 device correction and retest notes remain owner-observed, temporary feedback", () => {
  const review = source("../components/standard-theme-owner-review.tsx");
  const css = source("../app/standard-theme.css");
  assert.match(review, /deviceCorrections/);
  assert.match(review, /deviceRetests/);
  assert.match(review, /Not retested/);
  assert.match(review, /Still needs correction/);
  assert.match(review, /manual.*retest|Manual correction retest/s);
  assert.match(review, /setDeviceCorrections\(\{\}\)/);
  assert.match(review, /setDeviceRetests\(\{\}\)/);
  assert.match(review, /self-reported; not automatically verified/);
  assert.match(css, /camp-forecast__scenario-form/);
  assert.match(css, /camp-aging__evidence/);
  assert.match(css, /camp-device-review__item textarea/);
});
