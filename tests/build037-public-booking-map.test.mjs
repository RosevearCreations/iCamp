import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  normalizePublicBookingMapFilters,
  publicBookingMapPresentation,
  publicMapPolygonPoints,
} from "../lib/public-booking-map/core.mjs";

test("Build 037 normalizes date and public map filters", () => {
  assert.deepEqual(
    normalizePublicBookingMapFilters({
      arrivalDate: "2026-10-20",
      departureDate: "2026-10-23",
      kind: "RENTAL_COTTAGE",
      availability: "AVAILABLE",
    }),
    {
      arrivalDate: "2026-10-20",
      departureDate: "2026-10-23",
      kind: "rental_cottage",
      availability: "available",
    },
  );
});

test("Build 037 maps authoritative conditions to public colors", () => {
  assert.equal(publicBookingMapPresentation({ blockers: [] }).tone, "green");
  assert.equal(
    publicBookingMapPresentation({ blockers: ["reservation"] }).tone,
    "grey",
  );
  assert.equal(
    publicBookingMapPresentation({ blockers: ["turnover"] }).tone,
    "yellow",
  );
  assert.equal(
    publicBookingMapPresentation({ blockers: ["management_restriction"] }).tone,
    "red",
  );
});

test("Build 037 emits source-image polygon coordinates", () => {
  assert.equal(
    publicMapPolygonPoints({
      vertices: [
        { image: { x: 10, y: 20 } },
        { image: { x: 40, y: 20 } },
        { image: { x: 30, y: 50 } },
      ],
    }),
    "10,20 40,20 30,50",
  );
});

test("Build 037 repository surface keeps public booking map accessible", () => {
  const page = fs.readFileSync(
    new URL("../app/booking/map/page.tsx", import.meta.url),
    "utf8",
  );
  const component = fs.readFileSync(
    new URL("../app/booking/map/booking-map.tsx", import.meta.url),
    "utf8",
  );
  const postgres = fs.readFileSync(
    new URL("../lib/public-booking-map/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(page, /Skip map and use the accessible list/);
  assert.match(page, /IVR\/DTMF/);
  assert.match(component, /role="button"/);
  assert.match(component, /aria-label/);
  assert.match(postgres, /is_published/);
  assert.match(postgres, /live_accommodation_availability/);
  assert.match(postgres, /geometry_kind = 'polygon'/);
});
