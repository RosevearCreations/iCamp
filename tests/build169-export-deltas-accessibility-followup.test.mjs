import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FORECAST_ACTIVITY_LIMIT,
  parseForecastActivityHistory,
  recordForecastActivity,
  serializeForecastActivityHistory,
  sha256Hex,
} from "../lib/command-centre/forecast-saved-views-core.mjs";
import { summarizeEscalationAging } from "../lib/command-centre/escalation-aging-core.mjs";
import {
  captureEscalationRecheckReceipt,
  prioritizeEscalationRecheckDeltas,
} from "../lib/command-centre/escalation-recheck-receipts-core.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Build 169 hashes the exact text bytes and keeps bounded metadata-only local history", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.notEqual(await sha256Hex("a\r\nb\r\n"), await sha256Hex("a\nb\n"));
  const event = {
    action: "comparison_csv",
    occurredAt: "2026-10-31T15:00:00.000Z",
    viewCount: 1,
    sha256: await sha256Hex("sample csv"),
  };
  let history = [];
  for (let i = 0; i < FORECAST_ACTIVITY_LIMIT + 3; i++)
    history = recordForecastActivity(history, event);
  assert.equal(history.length, FORECAST_ACTIVITY_LIMIT);
  assert.deepEqual(
    parseForecastActivityHistory(serializeForecastActivityHistory(history)),
    history,
  );
  assert.deepEqual(parseForecastActivityHistory("corrupted"), []);
  assert.deepEqual(parseForecastActivityHistory("x".repeat(6001)), []);
  assert.deepEqual(
    parseForecastActivityHistory(
      JSON.stringify({ version: 1, events: [{ ...event, sha256: "invalid" }] }),
    ),
    [],
  );
  assert.throws(
    () => recordForecastActivity([], { ...event, viewCount: 100 }),
    /Invalid/,
  );
  assert.doesNotMatch(
    serializeForecastActivityHistory(history),
    /booked|guest|csv row/i,
  );
});

function makeCase(
  id,
  {
    state = "acknowledged",
    acknowledgedAt = null,
    severity = "routine",
    assignedToLabel = "Manager",
  } = {},
) {
  return {
    id: `case-${id}`,
    accommodationCode: `Site-${id}`,
    summary: `Case ${id}`,
    caseState: "escalated",
    severity,
    assignedToLabel,
    escalations: [
      {
        id: `event-${id}`,
        state,
        escalationLevel: "manager",
        raisedAt: "2026-10-30T08:00:00.000Z",
        acknowledgedAt,
      },
    ],
  };
}

test("Build 169 prioritizes missing-active and regressed source deltas without closure claims", () => {
  const first = summarizeEscalationAging(
    [
      makeCase("missing", { severity: "urgent", assignedToLabel: null }),
      makeCase("regressed", { acknowledgedAt: "2026-10-30T08:40:00.000Z" }),
      makeCase("better"),
      makeCase("stable"),
    ],
    new Date("2026-10-31T08:00:00.000Z"),
  );
  const receipts = first.items.map((item) =>
    captureEscalationRecheckReceipt(first, item.escalationId),
  );
  const updated = summarizeEscalationAging(
    [
      makeCase("regressed"),
      makeCase("better", { acknowledgedAt: "2026-10-30T08:40:00.000Z" }),
      makeCase("stable"),
    ],
    new Date("2026-10-31T10:00:00.000Z"),
  );
  const deltas = prioritizeEscalationRecheckDeltas(receipts, updated);
  assert.deepEqual(
    deltas.items.map((item) => item.kind),
    ["missing_active_source", "status_delta", "status_delta", "new_snapshot"],
  );
  assert.equal(deltas.items[0].currentStatus, null);
  assert.match(deltas.items[0].guidance, /do not infer closure/);
  assert.equal(deltas.items[1].currentStatus, "missing_timestamp");
  assert.equal(deltas.items[2].currentStatus, "recorded");
  assert.equal(deltas.needsTriageCount, 3);
  assert.equal(deltas.newSnapshotCount, 1);
  assert.equal(
    prioritizeEscalationRecheckDeltas(receipts, first).items[0].kind,
    "await_refresh",
  );
  assert.throws(
    () => prioritizeEscalationRecheckDeltas([], null),
    /unavailable/,
  );
});

test("Build 169 interfaces expose checksum verification, source delta triage and manual accessibility acceptance follow-up", () => {
  const forecast = source("../components/forecast-saved-views.tsx");
  const board = source("../components/camper-escalation-aging-board.tsx");
  const owner = source("../components/standard-theme-owner-review.tsx");
  const css = source("../app/standard-theme.css");
  const forecastPage = source(
    "../app/workspaces/management/command/forecast/page.tsx",
  );
  assert.match(forecast, /\.sha256/);
  assert.match(forecast, /sha256Hex\(contents\)/);
  assert.match(forecast, /reviewRecoveryChecksum/);
  assert.match(forecast, /disabled=\{!recoveryReview\?\.canRestore\}/);
  assert.match(forecast, /Browser-local export and recovery history/);
  assert.match(forecast, /Clear local history/);
  assert.match(forecast, /not a server audit trail/);
  assert.match(forecastPage, /requireStaff|getCampgroundAuthorization/);
  assert.match(board, /prioritizeEscalationRecheckDeltas/);
  assert.match(board, /Prioritized recheck delta worklist/);
  assert.match(board, /not independent closure proof/);
  assert.match(owner, /Manual accessibility acceptance follow-up queue/);
  assert.match(owner, /Copy accessibility follow-up handoff/);
  assert.match(owner, /accessibilityFollowUps/);
  assert.match(owner, /owner_retested/);
  assert.match(owner, /version: 2/);
  assert.match(owner, /\[1, 2\]\.includes/);
  assert.match(owner, /not independent WCAG certification/);
  assert.match(css, /camp-forecast__history/);
  assert.match(css, /camp-theme-review__followup/);
  assert.doesNotMatch(
    forecast + board + owner,
    /sendSms|sendEmail|createCharge|acknowledgeAssistanceEscalationAction/,
  );
});
