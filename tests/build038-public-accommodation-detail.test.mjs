import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  humanizePublicFact,
  normalizePublicAccommodationDates,
  publicRateSummary,
} from "../lib/public-accommodation-detail/core.mjs";

test("Build 038 validates the public stay date window", () => {
  assert.deepEqual(
    normalizePublicAccommodationDates({
      arrivalDate: "2026-10-20",
      departureDate: "2026-10-23",
    }),
    {
      arrivalDate: "2026-10-20",
      departureDate: "2026-10-23",
      nights: 3,
    },
  );
  assert.throws(
    () =>
      normalizePublicAccommodationDates({
        arrivalDate: "2026-10-20",
        departureDate: "2026-10-20",
      }),
    /Departure must be after arrival/u,
  );
});

test("Build 038 keeps pricing truthful until Build 039", () => {
  const summary = publicRateSummary();
  assert.equal(summary.status, "rate_plans_pending");
  assert.match(summary.detail, /Build 039/u);
  assert.doesNotMatch(summary.detail, /\$\d/u);
});

test("Build 038 humanizes canonical accommodation facts", () => {
  assert.equal(humanizePublicFact("rental_cottage"), "Rental Cottage");
  assert.equal(humanizePublicFact("heat_pump"), "Heat Pump");
});

test("Build 038 repository surface consumes canonical models", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/booking/accommodations/[accommodationId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const postgres = fs.readFileSync(
    new URL("../lib/public-accommodation-detail/postgres.mjs", import.meta.url),
    "utf8",
  );
  const map = fs.readFileSync(
    new URL("../app/booking/map/booking-map.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Site \/ cottage gallery/u);
  assert.match(page, /Map context & nearby amenities/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /Build 041 checkout ownership/u);
  assert.match(postgres, /live_accommodation_availability/u);
  assert.match(postgres, /accommodation_public_gallery_images/u);
  assert.match(postgres, /campground_booking_rules/u);
  assert.match(postgres, /layer_key = 'amenities'/u);
  assert.match(
    postgres,
    /accommodation_kind in \('campsite', 'rental_cottage'\)/u,
  );
  assert.match(map, /View campsite \/ cottage details/u);
});
