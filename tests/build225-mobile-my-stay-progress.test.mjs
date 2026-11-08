import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildGuestStayProgress } from "../lib/my-stay-hub/guest-progress.mjs";

const futureStay = {
  reservation: {
    id: "reservation-225",
    status: "confirmed",
    arrivalDate: "2026-11-15",
    departureDate: "2026-11-18",
    campgroundLocalDate: "2026-11-08",
  },
  checkIn: null,
  checkOut: null,
};

function state(summary, id) {
  return summary.steps.find((step) => step.id === id)?.state;
}

test("Build 225 separates scheduled arrival and departure from recorded events", () => {
  const summary = buildGuestStayProgress(futureStay);
  assert.equal(summary.headline, "Your stay is scheduled");
  assert.deepEqual(
    summary.steps.map((step) => step.state),
    ["recorded", "scheduled", "pending", "scheduled"],
  );
  assert.match(summary.steps[1].detail, /no check-in recorded/i);
  assert.match(summary.steps[3].detail, /no checkout recorded/i);
  assert.equal(summary.hasUnverifiedMilestone, false);
});

test("Build 225 pending and overdue reservations never claim verified access", () => {
  const pending = buildGuestStayProgress({
    ...futureStay,
    reservation: { ...futureStay.reservation, status: "pending" },
  });
  assert.equal(state(pending, "booking"), "pending");
  assert.equal(state(pending, "arrival"), "pending");
  assert.equal(state(pending, "departure"), "pending");
  assert.match(pending.headline, /awaiting confirmation/);

  const overdue = buildGuestStayProgress({
    ...futureStay,
    reservation: {
      ...futureStay.reservation,
      campgroundLocalDate: "2026-11-20",
    },
  });
  assert.equal(state(overdue, "arrival"), "needs_review");
  assert.equal(state(overdue, "departure"), "needs_review");
  assert.equal(overdue.hasUnverifiedMilestone, true);

  assert.throws(() =>
    buildGuestStayProgress({
      ...futureStay,
      reservation: { ...futureStay.reservation, status: "unknown" },
    }),
  );
});

test("Build 225 verified check-in and checkout require actual source timestamps", () => {
  const checkedInStatusOnly = buildGuestStayProgress({
    ...futureStay,
    reservation: { ...futureStay.reservation, status: "checked_in" },
  });
  assert.equal(state(checkedInStatusOnly, "arrival"), "needs_review");
  assert.match(checkedInStatusOnly.headline, /needs verification/);

  const checkedIn = buildGuestStayProgress({
    ...futureStay,
    reservation: { ...futureStay.reservation, status: "checked_in" },
    checkIn: { checkedInAt: "2026-11-15T15:00:00Z" },
  });
  assert.equal(state(checkedIn, "arrival"), "recorded");
  assert.equal(state(checkedIn, "stay"), "recorded");
  assert.equal(state(checkedIn, "departure"), "scheduled");

  const completedStatusOnly = buildGuestStayProgress({
    ...futureStay,
    reservation: { ...futureStay.reservation, status: "completed" },
  });
  assert.equal(state(completedStatusOnly, "departure"), "needs_review");

  const completed = buildGuestStayProgress({
    ...futureStay,
    reservation: { ...futureStay.reservation, status: "completed" },
    checkIn: { checkedInAt: "2026-11-15T15:00:00Z" },
    checkOut: { checkedOutAt: "2026-11-18T10:00:00Z" },
  });
  assert.equal(state(completed, "arrival"), "recorded");
  assert.equal(state(completed, "departure"), "recorded");
  assert.equal(completed.hasUnverifiedMilestone, false);
});

test("Build 225 places mobile progress and scoped shortcuts on both protected guest views", async () => {
  const [component, hub, detail, styles] = await Promise.all([
    readFile("components/my-stay-progress.tsx", "utf8"),
    readFile("app/guest/hub/page.tsx", "utf8"),
    readFile("app/guest/stay/page.tsx", "utf8"),
    readFile("components/my-stay-progress.module.css", "utf8"),
  ]);
  assert.match(component, /aria-label="Reservation milestones"/);
  assert.match(component, /aria-label="Priority guest actions"/);
  assert.match(component, /encodeURIComponent\(reservation\.id\)/);
  assert.match(component, /stay\.documents\.confirmationNumber/);
  assert.match(component, /"confirmed"/);
  assert.match(component, /"checked_in"/);
  assert.match(component, /"completed"/);
  assert.match(component, /Scheduled dates are not proof/);
  assert.match(styles, /@media \(max-width: 530px\)/);
  assert.match(styles, /\.action:focus-visible/);
  assert.match(hub, /<MyStayProgress stay=\{stay\} view="hub"/);
  assert.match(detail, /<MyStayProgress stay=\{detail\} view="details"/);
  assert.match(hub, /requireSignedIn\("\/guest\/hub"\)/);
  assert.match(detail, /requireSignedIn\(path\)/);
  assert.match(hub, /getMyStayDetail\(\{[\s\S]*userId: session\.user\.id/);
  assert.match(detail, /getMyStayDetail\(\{[\s\S]*userId: session\.user\.id/);
  assert.doesNotMatch(
    component,
    /sendSms|sendEmail|capturePayment|authorizeGate|changeReservation/,
  );
});
