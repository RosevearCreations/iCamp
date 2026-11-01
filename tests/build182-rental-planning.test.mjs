import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  guestStayEligibleForRental,
  normalizeRentalOffer,
  normalizeRentalRequest,
  normalizeRentalWindow,
  rentalAvailabilityLabel,
} from "../lib/rental-planner/core.mjs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const window = { startDate: "2027-07-18", endDate: "2027-07-20", days: 3 };
const offer = {
  id: "listing",
  campgroundId: "campground",
  localDate: "2027-07-01",
  assetClass: "equipment",
  sourceReady: true,
  isPublished: true,
  acceptingRequests: true,
  available: true,
  maxDays: 7,
};
const stay = {
  id: "reservation",
  campgroundId: "campground",
  arrivalDate: "2027-07-17",
  departureDate: "2027-07-21",
  status: "confirmed",
};

test("Build182 validates real date windows with inclusive pickup and return", () => {
  assert.deepEqual(
    normalizeRentalWindow({
      startDate: window.startDate,
      endDate: window.endDate,
    }),
    window,
  );
  assert.deepEqual(normalizeRentalWindow({ startDate: "", endDate: "" }), null);
  assert.throws(
    () =>
      normalizeRentalWindow({ startDate: "2027-02-30", endDate: "2027-03-01" }),
    /date/i,
  );
  assert.throws(
    () =>
      normalizeRentalWindow({ startDate: "2027-07-19", endDate: "2027-07-18" }),
    /window/i,
  );
  assert.throws(
    () =>
      normalizeRentalWindow({ startDate: "2027-07-18", endDate: "2027-08-03" }),
    /window/i,
  );
  assert.throws(
    () => normalizeRentalWindow({ startDate: "2027-07-18" }),
    /Both/i,
  );
});

test("Build182 publication and intake input are bounded and independently explicit", () => {
  const normalized = normalizeRentalOffer({
    description: "Kayak for outdoor use",
    accessibilityNote: "Ask office",
    returnGuidance: "Return to desk",
    maxDays: 4,
    isPublished: true,
    acceptingRequests: true,
  });
  assert.equal(normalized.maxDays, 4);
  assert.throws(
    () => normalizeRentalOffer({ ...normalized, maxDays: 15 }),
    /Maximum/,
  );
  assert.throws(
    () =>
      normalizeRentalOffer({ ...normalized, description: "bad\u0000control" }),
    /Description/,
  );
  assert.throws(
    () => normalizeRentalOffer({ ...normalized, isPublished: false }),
    /publication/i,
  );
});

test("Build182 planning submissions demand valid immutable client replay IDs", () => {
  const request = {
    ...window,
    guestNote: "Return near clubhouse",
    clientRequestId: "67d45c46-7e55-4bb2-8c40-8c8daecc08c0",
  };
  assert.equal(normalizeRentalRequest(request).days, 3);
  assert.throws(
    () => normalizeRentalRequest({ ...request, clientRequestId: "abc" }),
    /UUID/i,
  );
  assert.throws(
    () => normalizeRentalRequest({ ...request, guestNote: "x".repeat(401) }),
    /Guest note/i,
  );
});

test("Build182 capacity language never invents rented or allocated equipment", () => {
  assert.match(
    rentalAvailabilityLabel(offer, window),
    /provisional planning request slot.*not an allocation/,
  );
  assert.match(
    rentalAvailabilityLabel({ ...offer, available: false }, window),
    /No provisional planning slot/,
  );
  assert.match(
    rentalAvailabilityLabel({ ...offer, sourceReady: false }, window),
    /not operational/,
  );
  assert.match(
    rentalAvailabilityLabel(offer, null),
    /Choose pickup and return dates/,
  );
  assert.match(
    rentalAvailabilityLabel({ ...offer, localDate: "2027-08-01" }, window),
    /passed/,
  );
});

test("Build182 guest eligibility requires matching stay, source, window and open slot", () => {
  assert.equal(guestStayEligibleForRental(stay, offer, window), true);
  for (const change of [
    { campgroundId: "other" },
    { status: "pending" },
    { arrivalDate: "2027-07-19" },
    { departureDate: "2027-07-19" },
  ])
    assert.equal(
      guestStayEligibleForRental({ ...stay, ...change }, offer, window),
      false,
    );
  for (const change of [
    { sourceReady: false },
    { available: false },
    { acceptingRequests: false },
    { maxDays: 2 },
  ])
    assert.equal(
      guestStayEligibleForRental(stay, { ...offer, ...change }, window),
      false,
    );
});

test("Build182 schema links every planning slot to one real scoped operational asset and guest reservation", () => {
  const sql = read(
    "../database/migrations/0192_build182_rental_planning_offers.sql",
  );
  assert.match(sql, /rental_offer_asset_unique unique \(asset_id\)/);
  assert.match(
    sql,
    /references public\.operational_assets\(organization_id,campground_id,id\)/,
  );
  assert.match(
    sql,
    /references public\.reservations\(organization_id,campground_id,id\)/,
  );
  assert.match(sql, /for update of o/i);
  assert.match(
    sql,
    /rr\.start_date<=new\.end_date and rr\.end_date>=new\.start_date/,
  );
  assert.match(sql, /r\.guest_user_id=new\.guest_user_id/);
  assert.match(sql, /force row level security/g);
  assert.match(sql, /rental_requests_no_direct_access/);
  assert.match(sql, /rental_request_one_active_per_stay_idx/);
});

test("Build182 excludes unsafe operational equipment and critical facilities from publication", () => {
  const sql = read(
    "../database/migrations/0192_build182_rental_planning_offers.sql",
  );
  assert.match(sql, /eq\.equipment_type in \('watercraft','cart','other'\)/);
  assert.match(sql, /f\.facility_type in \('sports_field','hall','other'\)/);
  assert.doesNotMatch(sql, /eq\.equipment_type in \('tractor'/);
  assert.doesNotMatch(sql, /f\.facility_type in \('gate'/);
});

test("Build182 actions verify guest identity and rental permission without calling a payment or dispatch provider", () => {
  const guest = read("../app/guest/rentals/actions.ts");
  const manager = read(
    "../app/workspaces/management/campgrounds/rentals/actions.ts",
  );
  const db = read("../lib/rental-planner/postgres.mjs");
  assert.match(guest, /requireSignedIn\(path\)/);
  assert.match(guest, /session\.user\.accountType\s*!==\s*"guest"/);
  assert.match(manager, /"rental\.manage"/);
  assert.match(db, /appendAuditEvent/);
  assert.match(db, /for update of o/i);
  assert.doesNotMatch(
    db,
    /fetch\(|stripe|sendEmail|sendSms|issueTicket|capturePayment/i,
  );
});

test("Build182 public/guest/staff routes disclose safe non-fulfillment semantics", () => {
  const pages = [
    read("../app/rentals/page.tsx"),
    read("../app/guest/rentals/page.tsx"),
    read("../app/workspaces/management/campgrounds/rentals/page.tsx"),
  ];
  assert.match(pages[0], /No rental planning items are published/);
  assert.match(pages[0], /Choose your dates/);
  assert.match(pages[1], /Withdraw planning request/);
  assert.match(pages[1], /No item was allocated or charged/);
  assert.match(pages[2], /Mark reviewed \(not allocated\)/);
});
