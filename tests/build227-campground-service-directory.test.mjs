import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildGuestServiceDirectory,
  normalizeGuestServiceFilters,
} from "../lib/guest-services/directory.mjs";

const wayfinding = [
  {
    id: "pool-227",
    kind: "pool",
    code: "POOL",
    name: "Main Pool",
    description: "Near the office on the published map.",
    accessibilityNote: "Ask staff about the ramp to the pool deck.",
    landmarkHint: "Across from the camp store",
    x: 100,
    y: 200,
  },
  {
    id: "washroom-227",
    kind: "washroom",
    code: "WC-1",
    name: "North Washroom",
    description: "Near the north camping loop.",
    accessibilityNote: "",
    landmarkHint: "",
    x: 200,
    y: 300,
  },
];

function directory(input = {}) {
  return buildGuestServiceDirectory({
    wayfinding,
    campgroundSlug: "camp rosevear/one",
    arrivalDate: "2026-11-15",
    departureDate: "2026-11-18",
    ...input,
  });
}

test("Build 227 shows only vetted published point content and never implies operational availability", () => {
  const result = directory();
  assert.equal(result.totalPublished, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].kindLabel, "Pools");
  assert.equal(
    result.items[0].accessibilityNote,
    wayfinding[0].accessibilityNote,
  );
  assert.equal(result.items[0].landmarkHint, wayfinding[0].landmarkHint);
  assert.match(result.items[0].availabilityLabel, /not verified here/i);
  assert.match(result.items[0].availabilityLabel, /ask the campground office/i);
  assert.equal(result.items[1].accessibilityNote, null);
  assert.equal(result.items[1].landmarkHint, null);
});

test("Build 227 search and category filters use the existing vetted public-wayfinding contract", () => {
  assert.deepEqual(
    directory({ filters: { kind: "pool" } }).items.map((item) => item.id),
    ["pool-227"],
  );
  assert.deepEqual(
    directory({ filters: { query: "north" } }).items.map((item) => item.id),
    ["washroom-227"],
  );
  assert.deepEqual(
    directory({ filters: { query: "ramp" } }).items.map((item) => item.id),
    ["pool-227"],
  );
  assert.equal(directory({ filters: { query: "not here" } }).items.length, 0);
  assert.equal(normalizeGuestServiceFilters({ kind: "invalid" }).kind, "all");
  assert.equal(
    normalizeGuestServiceFilters({ query: "A".repeat(500) }).query.length,
    80,
  );
});

test("Build 227 rejects non-public kinds, malformed points and missing campground context", () => {
  const result = directory({
    wayfinding: [
      ...wayfinding,
      { ...wayfinding[0], id: "", name: "Hidden" },
      { ...wayfinding[0], id: "internal", kind: "staff_only" },
      { ...wayfinding[0], id: "no-description", description: "" },
    ],
  });
  assert.equal(result.totalPublished, 2);
  assert.equal(result.items.length, 2);
  assert.throws(() => directory({ campgroundSlug: "" }));
  assert.throws(() => directory({ wayfinding: null }));
});

test("Build 227 constructs safely encoded published-map links, not invented routes", () => {
  const result = directory();
  assert.ok(
    result.mapHref.startsWith("/booking/map?campground=camp%20rosevear%2Fone"),
  );
  assert.ok(result.items[0].mapHref.endsWith("#wayfinding-amenity-pool-227"));
  assert.ok(!result.items[0].mapHref.includes("https://"));
  assert.ok(!result.items[0].mapHref.includes("route="));
});

test("Build 227 distinguishes unavailable map from a verified zero-item publication", () => {
  const empty = directory({ wayfinding: [] });
  assert.equal(empty.totalPublished, 0);
  assert.deepEqual(empty.items, []);
});

test("Build 227 uses guest-owned tenancy checks, verified public map source and safe no-source states", async () => {
  const [page, source, styles, hub, stay, arrival] = await Promise.all([
    readFile("app/guest/services/page.tsx", "utf8"),
    readFile("lib/public-booking-map/postgres.mjs", "utf8"),
    readFile("app/guest/services/services.module.css", "utf8"),
    readFile("app/guest/hub/page.tsx", "utf8"),
    readFile("app/guest/stay/page.tsx", "utf8"),
    readFile("lib/arrival-planner/guest-arrival-guide.mjs", "utf8"),
  ]);
  assert.match(page, /requireSignedIn\("\/guest\/services"\)/);
  assert.match(page, /session\.user\.accountType !== "guest"/);
  assert.match(page, /listMyStays\(\{ userId: session\.user\.id \}\)/);
  assert.match(page, /getMyStayDetail\(\{[\s\S]*userId: session\.user\.id/);
  assert.match(page, /getPublicBookingMapSnapshot\(\{/);
  assert.match(
    page,
    /published\.campground\.id === stay\.reservation\.campground\.id/,
  );
  assert.match(page, /Published facilities could not be verified/);
  assert.match(page, /No matching published services/);
  assert.match(page, /role="search"/);
  assert.match(page, /aria-label="Published campground amenities"/);
  assert.match(
    page,
    /New in-app assistance requests require a checked-in stay/,
  );
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(source, /w\.is_published and w\.reviewed_at is not null/);
  assert.match(source, /l\.layer_key='amenities' and l\.is_enabled/);
  assert.match(hub, /selectHref\("\/guest\/services"\)/);
  assert.match(stay, /\/guest\/services\?reservation=/);
  assert.match(arrival, /\/guest\/services\?reservation=/);
  assert.doesNotMatch(
    page,
    /authorizeGate|sendSms|createReservation|capturePayment/,
  );
});
