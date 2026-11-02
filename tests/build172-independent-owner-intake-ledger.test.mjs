import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  prepareStandardThemeOwnerIntake,
  readStandardThemeDecisionLedger,
  standardThemeDecisionReadbackSummary,
  STANDARD_OWNER_SUBMISSION_ENABLED,
} from "../lib/command-centre/standard-theme-owner-intake-core.mjs";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const preparerId = "33333333-3333-4333-8333-333333333333";
const reviewerId = "44444444-4444-4444-8444-444444444444";
const campgroundId = "55555555-5555-4555-8555-555555555555";
const otherCampground = "66666666-6666-4666-8666-666666666666";
const sha = "a".repeat(40);
const changedSha = "b".repeat(40);
const areaKeys = [
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
];
const buildReview = () => ({
  areas: areaKeys.map((key) => ({ key, reviewed: true })),
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
    note: `Manual observation for ${key}`,
    nextStep: "",
  })),
  notes: "Staff observed the three viewport profiles manually.",
});
const input = () => ({
  preparerId,
  intendedReviewerId: reviewerId,
  campgroundId,
  sourceSha: sha,
  sourceReference: "THEME-172-accessibility",
  review: buildReview(),
});

test("Build 172 produces only a versioned, source-bound, unsubmitted draft", () => {
  const result = prepareStandardThemeOwnerIntake(
    input(),
    new Date("2026-10-31T21:00:00.000Z"),
  );
  assert.equal(result.ready, true);
  assert.equal(result.packet.authority, "BROWSER_DRAFT_ONLY");
  assert.equal(
    result.packet.recordType,
    "unsubmitted_standard_theme_owner_review_intake",
  );
  assert.equal(result.packet.preparedByUserId, preparerId);
  assert.equal(result.packet.intendedReviewerUserId, reviewerId);
  assert.equal(result.packet.sourceSha, sha);
  assert.equal(result.packet.preparedAt, "2026-10-31T21:00:00.000Z");
  assert.equal(
    result.packet.accessibility[0].note,
    "Manual observation for keyboard",
  );
  assert.equal(result.packet.areas.length, 11);
  assert.equal(result.packet.devices.length, 3);
  assert.equal(result.packet.accessibility.length, 4);
  assert.equal(STANDARD_OWNER_SUBMISSION_ENABLED, false);
  assert.doesNotMatch(
    result.json,
    /actual_approval|owner_signed|billing_enabled/,
  );
});

test("Build 172 prevents self-review and requires source version, scope and actual retest", () => {
  const sameActor = input();
  sameActor.intendedReviewerId = preparerId.toUpperCase();
  assert.match(
    prepareStandardThemeOwnerIntake(sameActor).blockers.join("; "),
    /cannot be their own/,
  );
  const missingVersion = input();
  missingVersion.sourceSha = "";
  assert.match(
    prepareStandardThemeOwnerIntake(missingVersion).blockers.join("; "),
    /release source SHA/,
  );
  const missingScope = input();
  missingScope.campgroundId = "";
  assert.equal(prepareStandardThemeOwnerIntake(missingScope).ready, false);
  const correction = input();
  correction.review.devices[0].correction = "Keyboard focus remains clipped";
  assert.match(
    prepareStandardThemeOwnerIntake(correction).blockers.join("; "),
    /needs an owner retest/,
  );
  correction.review.devices[0].retest = "looks_fixed";
  assert.equal(prepareStandardThemeOwnerIntake(correction).ready, true);
  correction.review.accessibility[0].result = "needs_fix";
  assert.equal(prepareStandardThemeOwnerIntake(correction).ready, false);
});

const receipt = (overrides = {}) => ({
  id: "77777777-7777-4777-8777-777777777777",
  campgroundId,
  preparedByUserId: preparerId,
  reviewerUserId: reviewerId,
  sourceSha: sha,
  decision: "pending",
  occurredAt: "2026-10-31T19:00:00.000Z",
  evidenceReference: "THEME-172-owner-ledger",
  note: "External claim pending review",
  ...overrides,
});
const scope = () => ({ campgroundId, preparerId, sourceSha: sha });
const parse = (entries, context = scope()) =>
  readStandardThemeDecisionLedger(
    JSON.stringify({ version: 1, entries }),
    context,
  );

test("Build 172 historic ledger is bounded, scoped, chronological and explicitly unverified", () => {
  const entries = parse([
    receipt(),
    receipt({
      id: "88888888-8888-4888-8888-888888888888",
      sourceSha: changedSha,
      decision: "approved",
      occurredAt: "2026-10-31T20:00:00.000Z",
    }),
  ]);
  assert.equal(entries[1].needsSourceRecheck, true);
  assert.equal(entries[1].authenticity, "UNVERIFIED_IMPORTED_HISTORY");
  assert.deepEqual(standardThemeDecisionReadbackSummary(entries), {
    total: 2,
    claimedApproved: 1,
    recheck: 1,
    authoritativeDecisionRecorded: false,
  });
  assert.throws(
    () => parse([receipt({ reviewerUserId: preparerId })]),
    /scope, actor/,
  );
  assert.throws(
    () => parse([receipt({ campgroundId: otherCampground })]),
    /scope, actor/,
  );
  assert.throws(
    () => parse([receipt()], { ...scope(), preparerId: reviewerId }),
    /scope, actor/,
  );
  assert.throws(
    () => parse([receipt({ decision: "authoritative_approved" })]),
    /scope, actor/,
  );
  assert.throws(() => parse([receipt(), receipt()]), /scope, actor/);
  assert.throws(
    () => parse([receipt({ occurredAt: "2026-10-31" })]),
    /scope, actor/,
  );
  assert.throws(() => parse(Array(21).fill(receipt())), /oversized/);
  assert.throws(
    () => readStandardThemeDecisionLedger("not json", scope()),
    /valid JSON/,
  );
});

test("Build 172 guards actual server decision writes and protects the read-only capability route", () => {
  const route = file(
    "../app/api/standard-theme/owner-review-contract/route.ts",
  );
  assert.match(route, /getCurrentSession/);
  assert.match(
    route,
    /hasAnyCampgroundPermission\(session.user.id, "reports.read"\)/,
  );
  assert.match(route, /accountType !== "staff"/);
  assert.match(route, /submissionEnabled: false/);
  assert.match(route, /authoritativeDecisionLedgerEnabled: false/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /export async function POST/);
  const page = file("../app/settings/themes/acceptance/page.tsx");
  assert.match(page, /listAssignedCampgrounds/);
  assert.match(page, /hasCampgroundPermission/);
  const component = file("../components/standard-theme-independent-intake.tsx");
  assert.match(component, /Inspect read-only decision history/);
  assert.match(component, /Submission disabled/);
  assert.match(component, /Billing and\s+Omnichannel remain HELD/);
  assert.doesNotMatch(component, /fetch\(|XMLHttpRequest|form action=/);
});
