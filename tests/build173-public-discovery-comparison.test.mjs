import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  filterPublicDiscoveryItems,
  normalizePublicDiscoveryFilters,
  parsePublicComparison,
  recheckPublicComparison,
  savePublicComparison,
} from "../lib/public-booking-map/discovery.mjs";

const context = {
  campgroundSlug: "cedar-lake",
  arrivalDate: "2026-11-10",
  departureDate: "2026-11-12",
};

function item(id, kind, overrides = {}) {
  const base = {
    accommodationId: id,
    code: "A01",
    displayName: "Accessible site",
    accommodationKind: kind,
    availabilityRevision: 7,
    statusState: "available",
    blockers: [],
    label: "Available",
    selectable: true,
    discovery: {
      campsiteType: kind === "campsite" ? "rv" : null,
      serviceLevel: "serviced",
      isWaterfront: false,
      electricalAmperage: kind === "campsite" ? 30 : null,
      waterService: "site",
      wifiService: "shared",
      maxRvLengthMeters: kind === "campsite" ? 12 : null,
      pullThrough: true,
      hasFireRing: false,
      hasPicnicTable: true,
      accessibleSite: kind === "campsite" ? true : null,
      maxOccupancy: kind === "rental_cottage" ? 4 : null,
      bedroomCount: kind === "rental_cottage" ? 2 : null,
      stepFreeAccess: kind === "rental_cottage" ? true : null,
      accessibleWashroom: kind === "rental_cottage" ? false : null,
      kitchenType: null,
      petsAllowed: true,
      maxPets: 2,
      photoCount: 2,
      describedPhotoCount: 2,
    },
  };
  return {
    ...base,
    ...overrides,
    discovery: { ...base.discovery, ...overrides.discovery },
  };
}

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

test("Build 173 bounded filters reject malformed/overbroad input", () => {
  assert.deepEqual(normalizePublicDiscoveryFilters({}), {
    campsiteType: "all",
    accessibility: "all",
    amenity: "all",
    photos: "all",
    guests: 0,
    pets: 0,
    rvLengthMeters: 0,
  });
  for (const input of [
    { campsiteType: "hacked" },
    { accessibility: "maybe" },
    { amenity: "free_text" },
    { photos: "private" },
    { guests: "-1" },
    { guests: "81" },
    { guests: "1.5" },
    { pets: "21" },
    { rvLengthMeters: "Infinity" },
    { rvLengthMeters: "1.234" },
  ]) {
    assert.throws(() => normalizePublicDiscoveryFilters(input), /invalid/);
  }
});

test("Build 173 filters only from attested public inventory, never guesses missing fit", () => {
  const campsite = item(ids[0], "campsite");
  const cottage = item(ids[1], "rental_cottage");
  const unknownRv = item(ids[2], "campsite", {
    discovery: {
      maxRvLengthMeters: null,
      accessibleSite: false,
      photoCount: 0,
      describedPhotoCount: 0,
    },
  });
  const data = [campsite, cottage, unknownRv];
  const matches = (input) =>
    filterPublicDiscoveryItems(data, normalizePublicDiscoveryFilters(input));
  assert.deepEqual(matches({ campsiteType: "rv" }), [campsite, unknownRv]);
  assert.deepEqual(matches({ accessibility: "advertised_site" }), [campsite]);
  assert.deepEqual(matches({ accessibility: "step_free" }), [cottage]);
  assert.deepEqual(matches({ accessibility: "accessible_washroom" }), []);
  assert.deepEqual(matches({ amenity: "electric" }), [campsite, unknownRv]);
  assert.deepEqual(matches({ amenity: "wifi" }), data);
  assert.deepEqual(matches({ guests: 3 }), [cottage]);
  assert.deepEqual(matches({ pets: 2 }), data);
  assert.deepEqual(matches({ pets: 3 }), []);
  assert.deepEqual(matches({ rvLengthMeters: 10 }), [campsite]);
  assert.deepEqual(matches({ rvLengthMeters: 13 }), []);
  assert.deepEqual(matches({ photos: "described" }), [campsite, cottage]);
});

test("Build 173 saved comparisons are capped, campground-scoped and detect stale live holds", () => {
  const accommodation = item(ids[0], "campsite");
  const cottage = item(ids[1], "rental_cottage");
  const record = savePublicComparison(
    [accommodation, cottage],
    context,
    "2026-11-01T10:00:00.000Z",
  );
  assert.deepEqual(
    parsePublicComparison(JSON.stringify(record), context.campgroundSlug),
    record,
  );
  assert.equal(
    parsePublicComparison(JSON.stringify(record), "different-campground"),
    null,
  );
  assert.equal(parsePublicComparison("{", context.campgroundSlug), null);
  assert.equal(
    parsePublicComparison(
      JSON.stringify({
        ...record,
        entries: [record.entries[0], record.entries[0]],
      }),
      context.campgroundSlug,
    ),
    null,
  );
  assert.throws(() => savePublicComparison([], context), /one to three/);
  assert.throws(
    () =>
      savePublicComparison(
        [accommodation, cottage, accommodation, cottage],
        context,
      ),
    /one to three/,
  );
  assert.throws(
    () => savePublicComparison([accommodation, accommodation], context),
    /duplicate/,
  );
  assert.throws(
    () => savePublicComparison([item(ids[3], "permanent_unit")], context),
    /Only campsites/,
  );

  const initially = recheckPublicComparison(
    record,
    [accommodation, cottage],
    context,
  );
  assert.equal(
    initially.entries.every((entry) => !entry.changed),
    true,
  );
  const held = {
    ...accommodation,
    blockers: ["temporary_hold"],
    selectable: false,
    label: "Unavailable",
  };
  const rechecked = recheckPublicComparison(record, [held], context);
  assert.equal(rechecked.entries[0].changed, true);
  assert.equal(rechecked.entries[0].item.selectable, false);
  assert.equal(rechecked.entries[1].changed, true);
  assert.equal(rechecked.entries[1].item, null);
  assert.equal(
    recheckPublicComparison(record, [accommodation, cottage], {
      ...context,
      arrivalDate: "2026-11-11",
    }).datesChanged,
    true,
  );
});

test("Build 173 integration uses published polygons, public-only galleries and live date source", () => {
  const map = fs.readFileSync(
    new URL("../lib/public-booking-map/postgres.mjs", import.meta.url),
    "utf8",
  );
  const page = fs.readFileSync(
    new URL("../app/booking/map/page.tsx", import.meta.url),
    "utf8",
  );
  const results = fs.readFileSync(
    new URL("../app/booking/map/discovery-results.tsx", import.meta.url),
    "utf8",
  );
  assert.match(map, /live_accommodation_availability/);
  assert.match(map, /b\.geometry_kind = 'polygon'/);
  assert.match(map, /m\.classification = 'public'/);
  assert.match(map, /g\.is_active/);
  assert.match(page, /filterPublicDiscoveryItems/);
  assert.match(page, /Skip map and use the accessible list/);
  assert.match(results, /aria-live="polite"/);
  assert.match(results, /scope="row"/);
  assert.match(results, /window\.localStorage/);
  assert.match(results, /Refresh live availability/);
  assert.match(results, /Build 174/);
});
