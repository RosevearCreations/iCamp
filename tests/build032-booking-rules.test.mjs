import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateBookingDateRules,
  validateBookingPolicyInput,
  validateCalendarPeriodInput,
} from "../lib/booking-rules/core.mjs";

const policy = {
  checkInTime: "15:00",
  checkOutTime: "11:00",
  minimumBookingLeadDays: 1,
  maximumBookingLeadDays: 365,
  minimumStayNights: 2,
  maximumStayNights: 21,
  weekendIsoDays: [6, 7],
};

test("Build 032 validates campground booking policy bounds", () => {
  assert.deepEqual(validateBookingPolicyInput(policy), policy);
  assert.throws(
    () =>
      validateBookingPolicyInput({
        ...policy,
        minimumStayNights: 5,
        maximumStayNights: 2,
      }),
    /Maximum stay must be at least the minimum stay/u,
  );
  assert.throws(
    () => validateBookingPolicyInput({ ...policy, weekendIsoDays: [] }),
    /weekend days/u,
  );
});

test("Build 032 validates holiday and season calendar periods", () => {
  const period = validateCalendarPeriodInput({
    periodKind: "season",
    code: "summer-peak",
    displayName: "Summer peak",
    startsOn: "2027-06-25",
    endsOn: "2027-09-06",
    minimumStayNights: 3,
    maximumStayNights: 14,
    notes: "Peak operating season.",
  });
  assert.equal(period.periodKind, "season");
  assert.equal(period.minimumStayNights, 3);
  assert.throws(
    () =>
      validateCalendarPeriodInput({
        ...period,
        startsOn: "2027-09-07",
        endsOn: "2027-09-06",
      }),
    /End date must be on or after/u,
  );
});

test("Build 032 evaluates lead, stay, weekend, holiday and season rules", () => {
  const result = evaluateBookingDateRules({
    policy,
    bookingDate: "2027-06-20",
    arrivalDate: "2027-06-25",
    departureDate: "2027-06-29",
    periods: [
      {
        id: "season-1",
        periodKind: "season",
        code: "summer",
        displayName: "Summer",
        startsOn: "2027-06-01",
        endsOn: "2027-09-01",
        minimumStayNights: 3,
        maximumStayNights: null,
        isActive: true,
      },
      {
        id: "holiday-1",
        periodKind: "holiday",
        code: "canada-day",
        displayName: "Canada Day period",
        startsOn: "2027-06-28",
        endsOn: "2027-07-02",
        minimumStayNights: 4,
        maximumStayNights: null,
        isActive: true,
      },
    ],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.nights, 4);
  assert.equal(result.effectiveMinimumStay, 4);
  assert.ok(result.weekendNights >= 1);
  assert.deepEqual(result.seasonNames, ["Summer"]);
  assert.deepEqual(result.holidayNames, ["Canada Day period"]);
});

test("Build 032 rejects stays outside effective rule bounds", () => {
  const tooShort = evaluateBookingDateRules({
    policy,
    bookingDate: "2027-06-20",
    arrivalDate: "2027-06-21",
    departureDate: "2027-06-22",
    periods: [],
  });
  assert.equal(tooShort.eligible, false);
  assert.match(tooShort.issues.join(" "), /shorter/u);

  const tooFar = evaluateBookingDateRules({
    policy,
    bookingDate: "2027-01-01",
    arrivalDate: "2028-02-01",
    departureDate: "2028-02-03",
    periods: [],
  });
  assert.equal(tooFar.eligible, false);
  assert.match(tooFar.issues.join(" "), /beyond/u);
});
