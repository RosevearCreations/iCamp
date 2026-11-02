import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FORECAST_SAVED_LIMIT,
  parseSavedForecastViews,
  serializeSavedForecastViews,
  upsertSavedForecastView,
} from "../lib/command-centre/forecast-saved-views-core.mjs";
import {
  summarizeEscalationAging,
  summarizeEvidenceGapFollowUps,
} from "../lib/command-centre/escalation-aging-core.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Build 167 saves named forecast filters only, with bounded and validated local data", () => {
  const original = upsertSavedForecastView([], {
    label: "  Peak five months  ",
    lookbackMonths: 5,
    scenario: "high",
  });
  assert.deepEqual(original, [
    {
      key: "5:high",
      label: "Peak five months",
      lookbackMonths: 5,
      scenario: "high",
    },
  ]);
  const overwritten = upsertSavedForecastView(original, {
    label: "Revised",
    lookbackMonths: 5,
    scenario: "high",
  });
  assert.equal(overwritten.length, 1);
  assert.equal(overwritten[0].label, "Revised");
  assert.deepEqual(
    parseSavedForecastViews(serializeSavedForecastViews(overwritten)),
    overwritten,
  );
  assert.deepEqual(parseSavedForecastViews("{bad"), []);
  assert.deepEqual(
    parseSavedForecastViews(JSON.stringify({ version: 2, views: original })),
    [],
  );
  assert.deepEqual(
    parseSavedForecastViews(
      JSON.stringify({
        version: 1,
        views: [
          ...original,
          { label: "Invented", scenario: "future", lookbackMonths: 8 },
          ...original,
        ],
      }),
    ),
    original,
  );
  assert.throws(
    () =>
      upsertSavedForecastView([], {
        label: "",
        scenario: "low",
        lookbackMonths: 2,
      }),
    /name/,
  );
  assert.throws(
    () =>
      upsertSavedForecastView([], {
        label: "Invalid",
        scenario: "future",
        lookbackMonths: 2,
      }),
    /supported/,
  );
  const combinations = [2, 3, 5].flatMap((window) =>
    ["low", "weighted", "high"].map((scenario) => ({
      label: `${window} ${scenario}`,
      lookbackMonths: window,
      scenario,
    })),
  );
  let views = [];
  for (const item of combinations.slice(0, FORECAST_SAVED_LIMIT))
    views = upsertSavedForecastView(views, item);
  assert.throws(
    () => upsertSavedForecastView(views, combinations.at(-1)),
    /Remove/,
  );
});

test("Build 167 gap worklist prioritizes genuine source discrepancies and never treats pending as a gap", () => {
  const observedAt = new Date("2026-10-31T14:00:00Z");
  const rows = [
    {
      id: "ordinary",
      severity: "routine",
      state: "acknowledged",
      acknowledgedAt: null,
      raisedAt: "2026-10-30T12:00:00Z",
      assignedToLabel: "Manager",
    },
    {
      id: "urgent",
      severity: "urgent",
      state: "acknowledged",
      acknowledgedAt: "2026-10-29T12:00:00Z",
      raisedAt: "2026-10-30T12:00:00Z",
      assignedToLabel: null,
    },
    {
      id: "pending",
      severity: "urgent",
      state: "open",
      acknowledgedAt: null,
      raisedAt: "2026-10-28T12:00:00Z",
      assignedToLabel: null,
    },
    {
      id: "valid",
      severity: "routine",
      state: "acknowledged",
      acknowledgedAt: "2026-10-30T13:00:00Z",
      raisedAt: "2026-10-30T12:00:00Z",
      assignedToLabel: "Manager",
    },
  ];
  const cases = rows.map((item) => ({
    id: item.id,
    accommodationCode: `Site-${item.id}`,
    summary: item.id,
    caseState: "escalated",
    severity: item.severity,
    assignedToLabel: item.assignedToLabel,
    escalations: [
      {
        id: `event-${item.id}`,
        escalationLevel: "manager",
        state: item.state,
        raisedAt: item.raisedAt,
        acknowledgedAt: item.acknowledgedAt,
      },
    ],
  }));
  const result = summarizeEvidenceGapFollowUps(
    summarizeEscalationAging(cases, observedAt),
  );
  assert.equal(result.count, 2);
  assert.equal(result.urgentCount, 1);
  assert.equal(result.unassignedCount, 1);
  assert.deepEqual(
    result.items.map((item) => item.caseId),
    ["urgent", "ordinary"],
  );
  assert.equal(result.items[0].status, "invalid_timestamp");
  assert.equal(result.items[1].status, "missing_timestamp");
  assert.throws(() => summarizeEvidenceGapFollowUps(null), /unavailable/);
});

test("Build 167 authenticated comparison reads source once and retains the original permissions", () => {
  const page = source("../app/workspaces/management/command/forecast/page.tsx");
  const views = source("../components/forecast-saved-views.tsx");
  assert.match(page, /requireStaff/);
  assert.match(page, /getCampgroundAuthorization/);
  assert.match(page, /FORECAST_WINDOWS\.flatMap/);
  assert.match(page, /getCampgroundSegmentComparison/);
  assert.match(views, /localStorage/);
  assert.match(views, /userId.*campgroundId/);
  assert.match(views, /never booking counts|never booking data/i);
  assert.doesNotMatch(page + views, /createCharge|sendSms|modifyBooking/);
});

test("Build 167 evidence follow-up and owner device retest are explicitly local/manual, not approvals", () => {
  const board = source("../components/camper-escalation-aging-board.tsx");
  const review = source("../components/standard-theme-owner-review.tsx");
  const css = source("../app/standard-theme.css");
  assert.match(board, /summarizeEvidenceGapFollowUps/);
  assert.match(board, /Copy follow-up handoff/);
  assert.match(board, /Show unassigned gaps/);
  assert.match(board, /no ticket,\s+notification,\s+assignment/);
  assert.match(review, /Manual device retest worklist/);
  assert.match(review, /Save local retest draft/);
  assert.match(review, /Load local retest draft/);
  assert.match(review, /Delete saved retest draft/);
  assert.match(review, /not independently approved/);
  assert.match(css, /camp-device-review__queue/);
  assert.match(css, /camp-aging__followup/);
});
