import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeOfficeBookingIntake,
  normalizeOverflowAreaInput,
} from "../lib/office-booking/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0055_walk_up_overflow_office_booking.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0055_walk_up_overflow_office_booking.sql",
  import.meta.url,
);
const officeRepositoryUrl = new URL(
  "../lib/office-booking/postgres.mjs",
  import.meta.url,
);
const reservationRepositoryUrl = new URL(
  "../lib/reservation-management/postgres.mjs",
  import.meta.url,
);
const officePageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/office/page.tsx",
  import.meta.url,
);

test("Build 046 normalizes office, walk-up and overflow intake", () => {
  assert.deepEqual(normalizeOfficeBookingIntake({ bookingMode: "office" }), {
    bookingMode: "office",
    overflowAreaId: null,
    officeNote: null,
  });
  assert.equal(
    normalizeOfficeBookingIntake({ bookingMode: "walk_up" }).bookingMode,
    "walk_up",
  );
  assert.throws(
    () => normalizeOfficeBookingIntake({ bookingMode: "overflow" }),
    /overflow area is required/iu,
  );
  assert.equal(
    normalizeOverflowAreaInput({
      code: "Overflow-A",
      displayName: "North Field",
    }).code,
    "overflow-a",
  );
});

test("Build 046 schema keeps overflow configuration scoped and intake append-only", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.campground_overflow_areas/u);
  assert.match(sql, /create table public\.campground_overflow_area_members/u);
  assert.match(sql, /create table public\.reservation_office_intake/u);
  assert.match(sql, /reservation_office_intake_append_only/u);
  assert.match(sql, /force row level security/u);
  assert.doesNotMatch(
    sql,
    /grant[^;]*(?:update|delete)[^;]*reservation_office_intake/iu,
  );
});

test("Build 046 verification protects RLS and append-only intake", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /must FORCE RLS/u);
  assert.match(sql, /must remain append-only/u);
  assert.match(sql, /direct authenticated access must remain denied/u);
});

test("Build 046 inventory reuses Build 035 authoritative availability", async () => {
  const source = await readFile(officeRepositoryUrl, "utf8");
  assert.match(source, /live_accommodation_availability/u);
  assert.match(source, /stay_profile = 'walk_up'/u);
  assert.match(source, /campground_overflow_area_members/u);
  assert.match(source, /campground\.configuration/u);
  assert.match(source, /appendAuditEvent/u);
});

test("Build 046 canonical reservation creation records intake and validates special inventory", async () => {
  const source = await readFile(reservationRepositoryUrl, "utf8");
  assert.match(source, /normalizeOfficeBookingIntake/u);
  assert.match(source, /reservation_office_intake/u);
  assert.match(source, /walk-up booking/u);
  assert.match(source, /overflow booking/u);
  assert.match(source, /public\.reservations/u);
});

test("Build 046 exposes one front-office surface for office, walk-up and overflow booking", async () => {
  const page = await readFile(officePageUrl, "utf8");
  assert.match(page, /Walk-up, overflow & office booking/u);
  assert.match(page, /Walk-up campsite availability/u);
  assert.match(page, /Configured overflow areas/u);
  assert.match(page, /Create office reservation/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
});
