import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeGuestPetInput,
  normalizeGuestProfileInput,
  normalizeGuestRvInput,
  normalizeGuestSourceChannel,
  normalizeGuestVehicleInput,
} from "../lib/guest-profile/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0059_guest_profiles_saved_stay.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0059_guest_profiles_saved_stay.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/guest-profile/postgres.mjs",
  import.meta.url,
);
const guestPageUrl = new URL("../app/guest/profile/page.tsx", import.meta.url);
const staffPageUrl = new URL(
  "../app/workspaces/management/campgrounds/guests/page.tsx",
  import.meta.url,
);

test("Build 048 normalizes optional guest profile privacy choices", () => {
  const profile = normalizeGuestProfileInput({
    firstName: "  Alex ",
    lastName: " Camper ",
    preferredName: "Al",
    contactEmail: " ALEX@EXAMPLE.COM ",
    contactPhone: "519-555-0100",
    preferredContactChannel: "SMS",
    saveStayPreferences: true,
    allowStaffProfileLookup: false,
  });

  assert.equal(profile.firstName, "Alex");
  assert.equal(profile.lastName, "Camper");
  assert.equal(profile.contactEmail, "alex@example.com");
  assert.equal(profile.preferredContactChannel, "sms");
  assert.equal(profile.saveStayPreferences, true);
  assert.equal(profile.allowStaffProfileLookup, false);
  assert.equal(normalizeGuestSourceChannel("IVR"), "ivr");
});

test("Build 048 validates reusable RV, vehicle and pet stay details", () => {
  const rv = normalizeGuestRvInput({
    nickname: "Family trailer",
    rvKind: "travel_trailer",
    lengthFeet: "28.5",
    slideOutCount: "2",
    electricalServiceAmps: "30",
  });
  const vehicle = normalizeGuestVehicleInput({
    nickname: "Tow truck",
    vehicleKind: "tow_vehicle",
    make: "Example",
    modelYear: "2024",
  });
  const pet = normalizeGuestPetInput({
    name: "Scout",
    species: "dog",
    weightKg: "22.4",
  });

  assert.equal(rv.lengthFeet, 28.5);
  assert.equal(rv.electricalServiceAmps, 30);
  assert.equal(vehicle.vehicleKind, "tow_vehicle");
  assert.equal(vehicle.modelYear, 2024);
  assert.equal(pet.species, "dog");
  assert.equal(pet.weightKg, 22.4);
});

test("Build 048 schema uses optional accounts, privacy controls and append-only evidence", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.guest_profiles/u);
  assert.match(sql, /user_account_id uuid/u);
  assert.match(sql, /save_stay_preferences/u);
  assert.match(sql, /allow_staff_profile_lookup/u);
  assert.match(sql, /guest\.read/u);
  assert.match(sql, /guest\.manage/u);
  assert.match(sql, /guest_profile_events_append_only/u);
  assert.match(sql, /reservations_guest_profile_fk/u);
  assert.match(sql, /seasonal_assignments_guest_profile_fk/u);
  assert.doesNotMatch(sql, /plate_number/u);
});

test("Build 048 verification preserves RLS and direct-access boundaries", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /Guest profile evidence must remain append-only/u);
  assert.match(sql, /guest\.read profile policy missing/u);
  assert.match(sql, /guest\.manage profile update policy missing/u);
  assert.match(
    sql,
    /authenticated direct guest profile access must remain denied/u,
  );
  assert.match(sql, /Build 047 seasonal assignment integration missing/u);
});

test("Build 048 service reuses canonical reservation and receipt history", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /public\.reservation_receipts/u);
  assert.match(source, /public\.reservations/u);
  assert.match(source, /public\.seasonal_assignments/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /reservation\.modify/u);
  assert.match(source, /seasonal\.manage/u);
  assert.match(source, /guest\.manage/u);
});

test("Build 048 exposes full Web/PWA guest and staff surfaces with safe phone/SMS fallbacks", async () => {
  const [guestPage, staffPage] = await Promise.all([
    readFile(guestPageUrl, "utf8"),
    readFile(staffPageUrl, "utf8"),
  ]);
  assert.match(guestPage, /My saved stay information/u);
  assert.match(guestPage, /IVR\/DTMF/u);
  assert.match(guestPage, /SMS\/MMS/u);
  assert.match(guestPage, /Build 053/u);
  assert.match(guestPage, /marketing/u);
  assert.match(staffPage, /Optional profile/u);
  assert.match(staffPage, /account email blank/u);
  assert.match(staffPage, /Build 014/u);
  assert.match(staffPage, /Build\s+053/u);
});
