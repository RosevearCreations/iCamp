import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertLiveAvailability, mapAvailabilityRow, normalizeAvailabilityWindow } from "../lib/live-availability/core.mjs";

const migration = await readFile(new URL("../database/migrations/0043_server_authoritative_live_availability.sql", import.meta.url), "utf8");
const service = await readFile(new URL("../lib/live-availability/postgres.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../app/workspaces/management/campgrounds/availability/page.tsx", import.meta.url), "utf8");
const build = await readFile(new URL("../docs/BUILD_035.md", import.meta.url), "utf8");

test("Build 035 validates date windows and maps all blocking sources", () => {
  assert.deepEqual(normalizeAvailabilityWindow({ arrivalDate: "2027-07-01", departureDate: "2027-07-03" }), { arrivalDate: "2027-07-01", departureDate: "2027-07-03" });
  const item = mapAvailabilityRow({ accommodation_id: "a", availability_revision: 7, reservation_blocked: true, hold_blocked: true, restriction_blocked: true, turnover_blocked: true, seasonal_blocked: true });
  assert.equal(item.available, false);
  assert.deepEqual(item.blockers, ["reservation","temporary_hold","management_restriction","turnover","seasonal_assignment"]);
  assert.throws(() => assertLiveAvailability(item), (error) => error.code === "ICAMP_ACCOMMODATION_UNAVAILABLE");
});

test("Build 035 database serializes competing inventory writes", () => {
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /reservations_no_live_conflict/u);
  assert.match(migration, /reservation_holds_no_live_conflict/u);
  assert.match(migration, /seasonal_assignments_no_live_conflict/u);
  assert.match(migration, /Management closure or hold|management closure or hold/iu);
  assert.match(migration, /unresolved cottage turnover/u);
});

test("Build 035 provides one server-authoritative live read model", () => {
  assert.match(migration, /live_accommodation_availability/u);
  assert.match(service, /getLiveAvailabilitySnapshot/u);
  assert.match(service, /assertServerAvailable/u);
  assert.match(page, /ten-second live refresh/iu);
});

test("Build 035 preserves Build 036 ownership of atomic hold lifecycle", () => {
  assert.match(migration, /Build 036 owns atomic hold creation/u);
  assert.match(build, /Build 036 — Atomic Temporary Reservation Holds/u);
});
