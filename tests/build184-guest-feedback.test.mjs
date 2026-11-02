import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  feedbackPublicLabel,
  normalizeFeedbackAppeal,
  normalizeFeedbackDecision,
  normalizeFeedbackRecovery,
  normalizeGuestFeedback,
  recoveryResponseTemplate,
} from "../lib/guest-feedback/core.mjs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const input = {
  rating: "5",
  category: "accessibility",
  title: "Easy to navigate",
  publicSummary:
    "The campground walkways were easy to navigate during our completed stay.",
  privateDetails: "We would like a private discussion about the ramp.",
  publicRequested: true,
  assistanceCaseId: "",
};

test("Build184 input validation protects guest-authored ratings and private details", () => {
  assert.deepEqual(normalizeGuestFeedback(input), {
    ...input,
    rating: 5,
    assistanceCaseId: null,
  });
  for (const change of [
    { rating: 0 },
    { rating: 6 },
    { rating: 3.5 },
    { category: "private_incident" },
    { title: "bad" },
    { publicSummary: "too short" },
    { privateDetails: "x".repeat(2001) },
    { publicSummary: "bad\u0000data" },
    { assistanceCaseId: "another-guest-case" },
  ])
    assert.throws(() => normalizeGuestFeedback({ ...input, ...change }));
});

test("Build184 moderation requires an explicit decision and meaningful decline reason", () => {
  assert.deepEqual(
    normalizeFeedbackDecision({ decision: "approved", reason: "" }),
    { decision: "approved", reason: "" },
  );
  assert.equal(
    normalizeFeedbackDecision({
      decision: "declined",
      reason: "Contains identifying details",
    }).decision,
    "declined",
  );
  assert.throws(
    () => normalizeFeedbackDecision({ decision: "auto_approved", reason: "" }),
    /decision/i,
  );
  assert.throws(
    () => normalizeFeedbackDecision({ decision: "declined", reason: "no" }),
    /explanation/i,
  );
  assert.throws(() => normalizeFeedbackAppeal("short"), /appeal/i);
});

test("Build184 fixed recovery templates are respectful and not refunds or outbound messages", () => {
  for (const stage of [
    "reviewing",
    "action_planned",
    "resolved",
    "not_actionable",
  ]) {
    assert.match(recoveryResponseTemplate(stage), /team|staff|campground/i);
    assert.equal(
      normalizeFeedbackRecovery({ stage, dueDate: "", internalNote: "" })
        .guestVisibleSummary,
      recoveryResponseTemplate(stage),
    );
  }
  assert.match(
    recoveryResponseTemplate("resolved"),
    /does not confirm a refund/i,
  );
  assert.throws(() =>
    normalizeFeedbackRecovery({
      stage: "refund_issued",
      dueDate: "",
      internalNote: "",
    }),
  );
  assert.throws(() =>
    normalizeFeedbackRecovery({
      stage: "reviewing",
      dueDate: "2027-02-30",
      internalNote: "",
    }),
  );
  assert.match(
    feedbackPublicLabel({ rating: 4 }),
    /4 of 5 stars.*verified completed stay/,
  );
});

test("Build184 schema requires completed, guest-owned stays and case ownership within 180 days", () => {
  const sql = read(
    "../database/migrations/0195_build184_verified_guest_feedback_recovery.sql",
  );
  assert.match(sql, /verified_feedback_one_per_stay unique \(reservation_id\)/);
  assert.match(sql, /r\.guest_user_id=new\.guest_user_id/);
  assert.match(sql, /r\.status='completed'/);
  assert.match(sql, /r\.departure_date >= .*::date-180/);
  assert.match(sql, /ar\.reservation_id=new\.reservation_id/);
  assert.match(sql, /ar\.guest_user_id=new\.guest_user_id/);
  assert.match(sql, /public_requested and moderation_state='approved'/);
  assert.equal((sql.match(/force row level security/g) ?? []).length, 3);
  assert.match(sql, /verified_feedback_no_direct_access/);
  assert.match(sql, /guest_feedback_moderation_events/);
  assert.match(sql, /guest_feedback_recovery_events/);
});

test("Build184 staff cannot fabricate ratings, publish without consent or update assistance cases", () => {
  const db = read("../lib/guest-feedback/postgres.mjs");
  assert.match(
    db,
    /hasCampgroundPermission\(userId, campgroundId, "guest\.manage"\)/,
  );
  assert.match(db, /where id=\$1 and guest_user_id=\$2 for update/);
  assert.match(
    db,
    /f\.public_requested=true and f\.moderation_state='approved'/,
  );
  assert.match(db, /r\.status='completed' and c\.lifecycle_state='active'/);
  assert.match(db, /if \(!before\.public_requested/);
  assert.match(db, /moderation_state='pending'.*appeal_pending=false/s);
  assert.match(db, /appendAuditEvent/);
  assert.doesNotMatch(
    db,
    /fetch\(|stripe|capturePayment|sendEmail|sendSms|issueRefund|update public\.camper_assistance_cases/i,
  );
  // Moderation SQL updates only decision metadata, never guest-authored ratings or text.
  const section = db
    .split("export async function moderateGuestFeedback(")[1]
    .split("export async function recordGuestFeedbackRecovery(")[0];
  assert.doesNotMatch(section, /set rating=|set title=|set public_summary=/i);
});

test("Build184 public projection omits private guest identity and case evidence", () => {
  const db = read("../lib/guest-feedback/postgres.mjs");
  const section = db
    .split("export async function listPublicGuestReviews(")[1]
    .split("export async function listFeedbackEligibleStays(")[0];
  const returned = section.split("return result.rows.map((row) => (")[1];
  assert.ok(returned);
  assert.doesNotMatch(
    returned,
    /guestUserId:|reservationId:|privateDetails:|assistanceCaseId:|recoveryHistory:/,
  );
  assert.match(
    section,
    /f\.public_requested=true and f\.moderation_state='approved'/,
  );
});

test("Build184 routes expose safe guest, public and restricted staff workflows", () => {
  const publicPage = read("../app/reviews/page.tsx");
  const guestPage = read("../app/guest/feedback/page.tsx");
  const managerPage = read(
    "../app/workspaces/management/campgrounds/feedback/page.tsx",
  );
  const guestActions = read("../app/guest/feedback/actions.ts");
  const managerActions = read(
    "../app/workspaces/management/campgrounds/feedback/actions.ts",
  );
  assert.match(publicPage, /completed stays that guests explicitly requested/);
  assert.match(guestPage, /Withdraw public review consent now/);
  assert.match(guestPage, /In-app service-recovery updates/);
  assert.match(managerPage, /Staff cannot create a guest rating/i);
  assert.match(guestActions, /requireSignedIn\(path\)/);
  assert.match(guestActions, /accountType !== "guest"/);
  assert.match(managerActions, /"guest\.manage"/);
});
