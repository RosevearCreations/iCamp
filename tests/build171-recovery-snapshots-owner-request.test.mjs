import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseForecastActivityHistory,
  recordForecastActivity,
  reviewRecoveryChecksum,
} from "../lib/command-centre/forecast-saved-views-core.mjs";
import { summarizeEscalationAging } from "../lib/command-centre/escalation-aging-core.mjs";
import {
  captureEscalationRecheckReceipt,
  ESCALATION_SESSION_MAX_AGE_MS,
  parseEscalationSnapshotSession,
  prioritizeEscalationRecheckDeltas,
  serializeEscalationSnapshotSession,
} from "../lib/command-centre/escalation-recheck-receipts-core.mjs";
import { prepareIndependentOwnerAcceptanceRequest } from "../lib/command-centre/standard-theme-closure-readiness-core.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const digest = "a".repeat(64);

test("Build 171 blocks checksum mismatch and makes an unverified recovery an explicit exception", () => {
  assert.equal(reviewRecoveryChecksum(digest, "", false).canRestore, false);
  assert.equal(reviewRecoveryChecksum(digest, "", true).status, "unverified");
  assert.equal(reviewRecoveryChecksum(digest, "", true).canRestore, true);
  assert.equal(
    reviewRecoveryChecksum(digest, "invalid", true).canRestore,
    false,
  );
  assert.equal(
    reviewRecoveryChecksum(digest, "0".repeat(64), true).status,
    "mismatch",
  );
  assert.equal(
    reviewRecoveryChecksum(digest, "0".repeat(64), true).canRestore,
    false,
  );
  assert.equal(
    reviewRecoveryChecksum(digest, digest.toUpperCase(), false).status,
    "match",
  );
  assert.equal(reviewRecoveryChecksum(digest, digest, false).canRestore, true);
  assert.equal(reviewRecoveryChecksum("", digest, true).canRestore, false);
  const event = recordForecastActivity([], {
    action: "recovery_exception",
    occurredAt: "2026-10-31T17:00:00Z",
    viewCount: 2,
    sha256: digest,
    savedViewContents: "not allowed",
  });
  assert.equal(event[0].action, "recovery_exception");
  assert.equal(event[0].savedViewContents, undefined);
  assert.equal(
    parseForecastActivityHistory(JSON.stringify({ version: 1, events: event }))
      .length,
    1,
  );
});

const caseFor = (id, acknowledgedAt = null) => ({
  id: `case-${id}`,
  accommodationCode: `Site-${id}`,
  summary: `Case ${id}`,
  caseState: "escalated",
  severity: "urgent",
  assignedToLabel: null,
  escalations: [
    {
      id: `event-${id}`,
      state: "acknowledged",
      escalationLevel: "manager",
      raisedAt: "2026-10-31T08:00:00Z",
      acknowledgedAt,
    },
  ],
});

test("Build 171 retains only bounded, scoped same-tab snapshot metadata and detects later source changes", () => {
  const time = new Date("2026-10-31T10:00:00Z");
  const scope = { userId: "staff-1", campgroundId: "camp-1" };
  const original = summarizeEscalationAging(
    [caseFor("gone"), caseFor("changed", "2026-10-31T09:00:00Z")],
    time,
  );
  const receipts = original.items.map((item) =>
    captureEscalationRecheckReceipt(original, item.escalationId, time),
  );
  const saved = serializeEscalationSnapshotSession(receipts, scope, time);
  assert.deepEqual(
    parseEscalationSnapshotSession(saved, scope, time),
    receipts,
  );
  assert.deepEqual(
    parseEscalationSnapshotSession(
      saved,
      { userId: "different", campgroundId: "camp-1" },
      time,
    ),
    [],
  );
  assert.deepEqual(
    parseEscalationSnapshotSession(
      saved,
      { userId: "staff-1", campgroundId: "other" },
      time,
    ),
    [],
  );
  assert.deepEqual(
    parseEscalationSnapshotSession(
      saved,
      scope,
      new Date(time.getTime() + ESCALATION_SESSION_MAX_AGE_MS + 1),
    ),
    [],
  );
  const tampered = JSON.parse(saved);
  tampered.receipts[0].status = "closed_and_approved";
  assert.deepEqual(
    parseEscalationSnapshotSession(JSON.stringify(tampered), scope, time),
    [],
  );
  assert.throws(
    () =>
      serializeEscalationSnapshotSession(
        [...receipts, receipts[0]],
        scope,
        time,
      ),
    /valid scoped/,
  );
  assert.doesNotMatch(
    saved,
    /accommodationCode|Site-gone|Case gone|guest profile/,
  );

  const latest = summarizeEscalationAging(
    [caseFor("changed")],
    new Date("2026-10-31T11:00:00Z"),
  );
  const deltas = prioritizeEscalationRecheckDeltas(
    parseEscalationSnapshotSession(
      saved,
      scope,
      new Date("2026-10-31T11:00:00Z"),
    ),
    latest,
  );
  assert.equal(deltas.needsTriageCount, 2);
  assert.equal(deltas.items[0].kind, "missing_active_source");
  assert.equal(deltas.items[1].kind, "status_delta");
});

const complete = () => ({
  areas: [
    "command",
    "capacity",
    "seasonal",
    "segments",
    "forecast",
    "assistance",
    "resolution",
    "escalations",
    "it",
    "mobile",
    "accessibility",
  ].map((key) => ({ key, reviewed: true })),
  devices: ["desktop", "tablet", "phone"].map((key) => ({
    key,
    result: "passed",
    correction: "",
    retest: "not_retested",
  })),
  accessibility: ["keyboard", "zoom", "contrast", "motion"].map((key) => ({
    key,
    result: "passed",
    followUp: "owner_retested",
    priority: "normal",
  })),
  notes: "Owner observations only",
});

test("Build 171 generates an independent owner review request draft without simulating acceptance", () => {
  const clock = new Date("2026-10-31T12:00:00Z");
  const ready = prepareIndependentOwnerAcceptanceRequest(complete(), clock);
  assert.equal(ready.ready, true);
  assert.equal(ready.blockers.length, 0);
  assert.match(ready.text, /DRAFT; NOT APPROVAL/);
  assert.match(ready.text, /Prepared UTC: 2026-10-31T12:00:00.000Z/);
  assert.match(ready.text, /separately verify the real screens/);
  assert.match(ready.text, /no message was sent/i);
  const blockedInput = complete();
  blockedInput.areas[0].reviewed = false;
  blockedInput.devices[0].result = "issue";
  blockedInput.accessibility[0].followUp = "planned";
  const blocked = prepareIndependentOwnerAcceptanceRequest(blockedInput);
  assert.equal(blocked.ready, false);
  assert.equal(blocked.blockers.length, 3);
  assert.match(blocked.text, /BLOCKED/);
  assert.match(blocked.text, /BLOCKER: Screen command/);
  assert.equal(blocked.text.includes("not yet copied"), true);
});

test("Build 171 UI retains required gates and exposes scoped, manual-only controls", () => {
  const forecast = source("../components/forecast-saved-views.tsx");
  const board = source("../components/camper-escalation-aging-board.tsx");
  const owner = source("../components/standard-theme-owner-review.tsx");
  const route = source(
    "../app/workspaces/management/command/escalations/page.tsx",
  );
  assert.match(forecast, /acknowledgeUnverified/);
  assert.match(forecast, /disabled=\{!recoveryReview\?\.canRestore\}/);
  assert.match(forecast, /Copy integrity exception for manual review/);
  assert.match(board, /sessionStorage/);
  assert.match(board, /serializeEscalationSnapshotSession/);
  assert.match(board, /parseEscalationSnapshotSession/);
  assert.match(route, /userId=\{session\.user\.id\}/);
  assert.match(owner, /Copy independent review request draft/);
  assert.match(owner, /disabled=\{!independentRequest\.ready\}/);
  assert.doesNotMatch(
    forecast + board + owner,
    /sendSms|createCharge|openGateCommand/,
  );
});
