import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildGuestArrivalGuide } from "../lib/arrival-planner/guest-arrival-guide.mjs";

const stay = {
  reservation: {
    id: "guest-reservation-226",
    status: "confirmed",
    rowVersion: 4,
    arrivalDate: "2026-11-14",
    departureDate: "2026-11-17",
    campgroundLocalDate: "2026-11-08",
    campground: { slug: "camp-rosevear" },
  },
  rules: {
    currentCheckInTime: "15:00",
    guestSummary: "Check in with the office at the published time.",
  },
  documents: { confirmationNumber: "CR-226" },
  payment: { outstandingCents: 0, financialReviewRequired: false },
  checkIn: null,
  checkOut: null,
};

const arrival = {
  plan: { state: "submitted", sourceReservationVersion: 4, rowVersion: 2 },
  review: {
    outcome: "reviewed",
    reviewedReservationVersion: 4,
    reviewedPlanVersion: 2,
  },
};

function fact(guide, id) {
  return guide.facts.find((entry) => entry.id === id);
}

test("Build 226 uses only current reservation dates, local check-in time and published guidance", () => {
  const guide = buildGuestArrivalGuide({ stay, arrival });
  assert.equal(guide.phase, "before_arrival");
  assert.match(fact(guide, "arrival").detail, /2026-11-14.*local calendar/);
  assert.match(fact(guide, "time").detail, /15:00.*local time/);
  assert.equal(
    guide.campgroundGuidance,
    "Check in with the office at the published time.",
  );
  assert.match(fact(guide, "plan").detail, /submitted.*staff review/i);
  assert.match(
    fact(guide, "office").detail,
    /reviewed by staff.*not check-in/i,
  );
  assert.equal(guide.checkInAuthorized, false);
  assert.equal(guide.accessAuthorized, false);
  assert.equal(guide.notices.length, 0);
  assert.ok(
    guide.actions.some((action) =>
      action.href.includes(
        "/booking/reservations/guest-reservation-226/documents",
      ),
    ),
  );
});

test("Build 226 never invents missing arrival instructions, confirmation or receipt", () => {
  const guide = buildGuestArrivalGuide({
    stay: {
      ...stay,
      reservation: { ...stay.reservation, status: "pending" },
      rules: { currentCheckInTime: null, guestSummary: null },
      documents: { confirmationNumber: null },
    },
    arrival: null,
  });
  assert.equal(guide.phase, "pending");
  assert.equal(guide.campgroundGuidance, null);
  assert.match(fact(guide, "time").detail, /not supplied.*ask the office/i);
  assert.match(fact(guide, "confirmation").detail, /pending.*not confirmed/i);
  assert.match(fact(guide, "office").detail, /no current staff review/i);
  assert.ok(
    !guide.actions.some((action) => action.href.endsWith("/documents")),
  );
  assert.equal(guide.accessAuthorized, false);
});

test("Build 226 invalidates stale plans and reviews after a reservation version change", () => {
  const outdated = buildGuestArrivalGuide({
    stay: { ...stay, reservation: { ...stay.reservation, rowVersion: 5 } },
    arrival,
  });
  assert.match(fact(outdated, "plan").detail, /older reservation version/i);
  assert.match(fact(outdated, "office").detail, /no longer current/i);
  assert.equal(fact(outdated, "plan").state, "unknown");
  const olderReview = buildGuestArrivalGuide({
    stay,
    arrival: {
      plan: arrival.plan,
      review: { ...arrival.review, reviewedPlanVersion: 1 },
    },
  });
  assert.match(fact(olderReview, "office").detail, /no longer current/i);
  const followUp = buildGuestArrivalGuide({
    stay,
    arrival: {
      ...arrival,
      review: { ...arrival.review, outcome: "follow_up_needed" },
    },
  });
  assert.match(fact(followUp, "office").detail, /requested follow-up/i);
});

test("Build 226 treats unavailable arrival sources as unknown, not an empty plan", () => {
  const guide = buildGuestArrivalGuide({
    stay,
    arrival: null,
    arrivalAvailable: false,
  });
  assert.match(fact(guide, "plan").detail, /could not verify/i);
  assert.match(fact(guide, "office").detail, /could not be verified/i);
  assert.equal(fact(guide, "office").state, "unknown");
});

test("Build 226 keeps source receipt, pending status and financial concerns distinct", () => {
  const statusOnly = buildGuestArrivalGuide({
    stay: {
      ...stay,
      reservation: { ...stay.reservation, status: "checked_in" },
      payment: { outstandingCents: 1200, financialReviewRequired: true },
    },
    arrival,
  });
  assert.equal(statusOnly.phase, "office_review");
  assert.ok(
    statusOnly.notices.some((notice) => /receipt is missing/i.test(notice)),
  );
  assert.ok(
    statusOnly.notices.some((notice) => /financial review/i.test(notice)),
  );

  const checkedIn = buildGuestArrivalGuide({
    stay: {
      ...stay,
      reservation: { ...stay.reservation, status: "checked_in" },
      checkIn: { checkedInAt: "2026-11-14T20:00:00Z" },
    },
    arrival,
  });
  assert.equal(checkedIn.phase, "on_site");
  assert.match(checkedIn.assistanceHint, /during a recorded checked-in stay/i);

  const completedWithoutReceipt = buildGuestArrivalGuide({
    stay: {
      ...stay,
      reservation: { ...stay.reservation, status: "completed" },
      checkIn: { checkedInAt: "2026-11-14T20:00:00Z" },
    },
  });
  assert.equal(completedWithoutReceipt.phase, "office_review");
  assert.ok(
    completedWithoutReceipt.notices.some((notice) =>
      /checkout receipt/i.test(notice),
    ),
  );

  const completed = buildGuestArrivalGuide({
    stay: {
      ...stay,
      reservation: { ...stay.reservation, status: "completed" },
      checkOut: { checkedOutAt: "2026-11-17T15:00:00Z" },
    },
  });
  assert.equal(completed.phase, "past");
});

test("Build 226 uses encoded, reservation-scoped internal links and fails closed without stay ownership data", () => {
  const guide = buildGuestArrivalGuide({
    stay: {
      ...stay,
      reservation: {
        ...stay.reservation,
        id: "stay/?# one",
        campground: { slug: "camp/one & two" },
      },
    },
  });
  assert.ok(guide.actions.every((action) => action.href.startsWith("/")));
  assert.ok(
    guide.actions.some((action) =>
      action.href.includes("campground=camp%2Fone%20%26%20two"),
    ),
  );
  assert.ok(
    guide.actions.some((action) =>
      action.href.includes("reservation=stay%2F%3F%23%20one"),
    ),
  );
  assert.throws(() =>
    buildGuestArrivalGuide({
      stay: { ...stay, reservation: { ...stay.reservation, id: "" } },
    }),
  );
});

test("Build 226 is on authenticated pages, read-only and mobile accessible", async () => {
  const [guide, styles, hub, planner] = await Promise.all([
    readFile("components/guest-arrival-guide.tsx", "utf8"),
    readFile("components/guest-arrival-guide.module.css", "utf8"),
    readFile("app/guest/hub/page.tsx", "utf8"),
    readFile("app/guest/arrival-planner/page.tsx", "utf8"),
  ]);
  assert.match(hub, /requireSignedIn\("\/guest\/hub"\)/);
  assert.match(planner, /requireSignedIn\(path\)/);
  assert.match(
    hub,
    /<GuestArrivalGuide[\s\S]*arrivalAvailable=\{arrivalResult\.status === "fulfilled"\}/,
  );
  assert.match(planner, /<GuestArrivalGuide stay=\{stay\} arrival=\{bundle\}/);
  assert.match(guide, /aria-label="Arrival readiness and instructions"/);
  assert.match(guide, /aria-label="Arrival and help shortcuts"/);
  assert.match(guide, /does not authorize arrival/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /:focus-visible/);
  assert.doesNotMatch(
    guide,
    /authorizeGate|capturePayment|sendSms|sendEmail|checkInGuest/,
  );
});
