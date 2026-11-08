import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePublicBookingSearch } from "../lib/public-booking-map/search.mjs";

const defaults = {
  arrivalDate: "2026-07-10",
  departureDate: "2026-07-12",
};

test("Build 222 accepts real calendar dates and restrictive discovery filters", () => {
  const result = parsePublicBookingSearch(
    {
      campground: "camp-rosevear",
      accessibility: "step_free",
      guests: "2",
      photos: "described",
    },
    defaults,
  );
  assert.equal(result.ok, true);
  assert.equal(result.mapFilters.arrivalDate, defaults.arrivalDate);
  assert.equal(result.discoveryFilters.accessibility, "step_free");
  assert.equal(result.discoveryFilters.guests, 2);
  assert.equal(result.discoveryFilters.photos, "described");
});

test("Build 222 rejects impossible dates and reversed stays before source reads", () => {
  for (const input of [
    { arrivalDate: "2026-02-30", departureDate: "2026-03-03" },
    { arrivalDate: "2026-07-12", departureDate: "2026-07-10" },
    { arrivalDate: "nope", departureDate: "2026-07-12" },
    { arrivalDate: "2026-07-10", departureDate: "2026-07-10" },
  ]) {
    const result = parsePublicBookingSearch(input, defaults);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.match(result.message, /date/i);
  }
});

test("Build 222 fails closed for invalid or extreme filter values", () => {
  for (const input of [
    { kind: "../../../../private" },
    { availability: "unknown" },
    { accessibility: "invented" },
    { guests: "99999" },
    { guests: "1e9" },
    { pets: "-1" },
    { rvLengthMeters: "Infinity" },
  ]) {
    const result = parsePublicBookingSearch(input, defaults);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.match(result.message, /filter/i);
  }
});

test("Build 222 shows guest task links without replacing server authorization", async () => {
  const shell = await readFile("components/app-shell.tsx", "utf8");
  const home = await readFile("app/page.tsx", "utf8");
  const booking = await readFile("app/booking/map/page.tsx", "utf8");
  const workspace = await readFile(
    "app/workspaces/[workspace]/page.tsx",
    "utf8",
  );

  assert.match(shell, /Find a stay/);
  assert.match(shell, /My stay/);
  assert.match(shell, /Administration &amp; system tools/);
  assert.match(home, /Staff workspace \(sign-in required\)/);
  assert.match(booking, /parsePublicBookingSearch\(params/);
  assert.match(booking, /No availability lookup or reservation was made/);
  assert.match(workspace, /requireAnyCampgroundPermission\(/);
  assert.match(workspace, /requireSignedIn\(/);
});
