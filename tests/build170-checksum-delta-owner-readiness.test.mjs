import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseExpectedSha256,
  parseForecastActivityHistory,
  recordForecastActivity,
  serializeForecastActivityHistory,
  sha256Hex,
  verifyExportChecksum,
} from "../lib/command-centre/forecast-saved-views-core.mjs";
import { summarizeEscalationAging } from "../lib/command-centre/escalation-aging-core.mjs";
import {
  captureEscalationRecheckReceipt,
  createEscalationDeltaEvidenceHandoff,
  prioritizeEscalationRecheckDeltas,
} from "../lib/command-centre/escalation-recheck-receipts-core.mjs";
import { summarizeStandardThemeClosureReadiness } from "../lib/command-centre/standard-theme-closure-readiness-core.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test("Build 170 checks raw export bytes, exact companion filename and bounded metadata-only activity", async () => {
  const bytes = new TextEncoder().encode("abc").buffer;
  assert.equal(parseExpectedSha256(hash.toUpperCase(), "sample.csv"), hash);
  assert.equal(
    parseExpectedSha256(`${hash}  sample.csv\n`, "sample.csv"),
    hash,
  );
  assert.equal(
    parseExpectedSha256(`${hash}  *sample.csv\n`, "sample.csv"),
    hash,
  );
  assert.throws(
    () => parseExpectedSha256(`${hash}  wrong.csv`, "sample.csv"),
    /does not match/,
  );
  assert.throws(
    () => parseExpectedSha256("not a digest", "sample.csv"),
    /does not match/,
  );
  assert.deepEqual(await verifyExportChecksum(bytes, hash, "sample.csv"), {
    actualSha256: hash,
    expectedSha256: hash,
    matches: true,
  });
  assert.equal(
    (await verifyExportChecksum(bytes, "0".repeat(64), "sample.csv")).matches,
    false,
  );
  const invalidUtf8 = Uint8Array.of(0xff, 0, 0x80).buffer;
  assert.notEqual(
    (await verifyExportChecksum(invalidUtf8, hash, "sample.csv")).actualSha256,
    await sha256Hex(new TextDecoder().decode(invalidUtf8)),
  );
  const activity = recordForecastActivity([], {
    action: "verification_mismatch",
    occurredAt: "2026-10-31T22:00:00Z",
    viewCount: 0,
    sha256: hash,
    guestDetails: "must not persist",
  });
  assert.deepEqual(
    parseForecastActivityHistory(serializeForecastActivityHistory(activity)),
    activity,
  );
  assert.doesNotMatch(
    JSON.stringify(activity),
    /guestDetails|must not persist/,
  );
});

function sample(id, acknowledgedAt = null) {
  return {
    id: `case-${id}`,
    accommodationCode: `Site-${id}`,
    summary: `Sample ${id}`,
    caseState: "escalated",
    severity: "urgent",
    assignedToLabel: null,
    escalations: [
      {
        id: `event-${id}`,
        escalationLevel: "manager",
        state: "acknowledged",
        raisedAt: "2026-10-29T08:00:00Z",
        acknowledgedAt,
      },
    ],
  };
}

test("Build 170 evidence handoff pins source/readback times and never calls a missing item closed", () => {
  const earlier = summarizeEscalationAging(
    [
      sample("gone"),
      sample("changed", "2026-10-29T09:00:00Z"),
      sample("stable"),
    ],
    new Date("2026-10-31T10:00:00Z"),
  );
  const receipts = earlier.items.map((item) =>
    captureEscalationRecheckReceipt(earlier, item.escalationId),
  );
  const latest = summarizeEscalationAging(
    [sample("changed"), sample("stable")],
    new Date("2026-10-31T11:00:00Z"),
  );
  const deltas = prioritizeEscalationRecheckDeltas(receipts, latest);
  const triage = createEscalationDeltaEvidenceHandoff(
    latest,
    deltas,
    "camp-one",
  );
  assert.equal(triage.selectedCount, 2);
  assert.match(
    triage.text,
    /Current authorized source snapshot UTC: 2026-10-31T11:00:00.000Z/,
  );
  assert.match(triage.text, /earlier captured/);
  assert.match(triage.text, /current source/);
  assert.match(triage.text, /#assistance-case-case-gone/);
  assert.match(triage.text, /Missing from active source does not mean closed/);
  assert.doesNotMatch(triage.text, /case-stable/);
  assert.equal(
    createEscalationDeltaEvidenceHandoff(latest, deltas, "camp-one", "all")
      .selectedCount,
    3,
  );
  assert.throws(
    () => createEscalationDeltaEvidenceHandoff(latest, deltas, "", "triage"),
    /scope/,
  );
  assert.throws(
    () =>
      createEscalationDeltaEvidenceHandoff(latest, deltas, "camp", "closed"),
    /scope/,
  );
});

const input = () => ({
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
    followUp: "open",
    priority: "normal",
  })),
});

test("Build 170 owner closure preflight blocks unresolved issues and never grants approval", () => {
  const complete = input();
  const ready = summarizeStandardThemeClosureReadiness(complete);
  assert.equal(ready.canRequestIndependentReview, true);
  assert.equal(ready.blockers.length, 0);
  assert.equal(ready.areasReviewed, 11);
  assert.equal(ready.devicePasses, 3);
  assert.equal(ready.accessibilityPasses, 4);

  complete.areas[0].reviewed = false;
  complete.devices[1].correction = "Text clipped at 200%";
  complete.accessibility[0].result = "needs_fix";
  const blocked = summarizeStandardThemeClosureReadiness(complete);
  assert.equal(blocked.canRequestIndependentReview, false);
  assert.equal(blocked.blockers.length, 3);
  assert.match(blocked.blockers.join(" "), /Screen command/);
  assert.match(blocked.blockers.join(" "), /Device tablet/);
  assert.match(blocked.blockers.join(" "), /Accessibility keyboard/);
  complete.areas[0].reviewed = true;
  complete.devices[1].retest = "looks_fixed";
  complete.accessibility[0].result = "passed";
  complete.accessibility[0].priority = "urgent";
  assert.match(
    summarizeStandardThemeClosureReadiness(complete).blockers.join(" "),
    /urgent owner recheck/,
  );
  complete.accessibility[0].followUp = "owner_retested";
  assert.equal(
    summarizeStandardThemeClosureReadiness(complete)
      .canRequestIndependentReview,
    true,
  );
  assert.throws(
    () => summarizeStandardThemeClosureReadiness(null),
    /unavailable/,
  );
  assert.equal(
    summarizeStandardThemeClosureReadiness({
      areas: [],
      devices: [],
      accessibility: [],
    }).canRequestIndependentReview,
    false,
  );
});

test("Build 170 UIs expose opt-in verification, source-pinned copy, and closure preflight without writes", () => {
  const forecast = source("../components/forecast-saved-views.tsx");
  const board = source("../components/camper-escalation-aging-board.tsx");
  const owner = source("../components/standard-theme-owner-review.tsx");
  const styles = source("../app/standard-theme.css");
  const forecastPage = source(
    "../app/workspaces/management/command/forecast/page.tsx",
  );
  const escalationPage = source(
    "../app/workspaces/management/command/escalations/page.tsx",
  );
  const ownerPage = source("../app/settings/themes/acceptance/page.tsx");
  assert.match(forecast, /verifyExportChecksum/);
  assert.match(forecast, /file\.arrayBuffer\(\)/);
  assert.match(forecast, /Copy activity review/);
  assert.match(forecast, /Checksum checks only/);
  assert.match(
    forecast,
    /Equality does not establish authenticity or approval/,
  );
  assert.match(board, /Copy source-pinned delta evidence handoff/);
  assert.match(board, /createEscalationDeltaEvidenceHandoff/);
  assert.match(board, /Source snapshot UTC:/);
  assert.match(owner, /summarizeStandardThemeClosureReadiness/);
  assert.match(owner, /Owner accessibility closure readiness/);
  assert.match(owner, /Copy closure readiness handoff/);
  assert.match(owner, /NOT APPROVAL/);
  assert.match(owner, /version: 2/);
  assert.match(owner, /reviewedAreas: reviews\s*\.filter/);
  assert.match(owner, /reviewedDraft\.includes/);
  assert.match(forecastPage, /requireStaff|getCampgroundAuthorization/);
  assert.match(escalationPage, /listAssistanceQueue/);
  assert.match(
    ownerPage,
    /Cross-Device Review|Independent Owner Review Request Preparation/,
  );
  assert.match(styles, /camp-forecast__verification/);
  assert.match(styles, /camp-aging__delta-handoff/);
  assert.match(styles, /camp-theme-review__readiness/);
  assert.doesNotMatch(
    forecast + board + owner,
    /sendSms|sendEmail|createCharge|acknowledgeAssistanceEscalationAction/,
  );
});
