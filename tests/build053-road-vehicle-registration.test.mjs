import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeRoadVehicleRegistrationInput,
  normalizeRoadVehicleRevocationReason,
} from "../lib/road-vehicle-registration/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0067_road_vehicle_registration.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0067_road_vehicle_registration.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/road-vehicle-registration/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/vehicles/page.tsx",
  import.meta.url,
);
const helpUrl = new URL("../lib/help/topics.ts", import.meta.url);
const reservationPageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/page.tsx",
  import.meta.url,
);

test("Build 053 normalizes formal plate, jurisdiction and validity", () => {
  const value = normalizeRoadVehicleRegistrationInput({
    vehicleKind: "truck",
    plateNumber: " abc-123 ",
    plateJurisdiction: " on ",
    vehicleDescription: "2024 blue Ford F-150",
    registeredOwnerName: "Jamie Camper",
    primaryDriverName: "Alex Camper",
    validFrom: "2027-07-01",
    validUntil: "2027-07-07",
    notes: "Tow vehicle for site 22.",
  });

  assert.equal(value.vehicleKind, "truck");
  assert.equal(value.plateNumber, "ABC-123");
  assert.equal(value.plateJurisdiction, "ON");
  assert.equal(value.validFrom, "2027-07-01");
  assert.equal(value.validUntil, "2027-07-07");
});

test("Build 053 rejects backward validity and requires a revocation reason", () => {
  assert.throws(
    () =>
      normalizeRoadVehicleRegistrationInput({
        vehicleKind: "car",
        plateNumber: "ABC123",
        plateJurisdiction: "ON",
        vehicleDescription: "Blue sedan",
        registeredOwnerName: "Jamie Camper",
        primaryDriverName: "Jamie Camper",
        validFrom: "2027-07-08",
        validUntil: "2027-07-01",
      }),
    /valid until must be on or after valid from/iu,
  );

  assert.throws(() => normalizeRoadVehicleRevocationReason(""), /required/iu);
});

test("Build 053 schema keeps formal registration separate from passes and fees", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.road_vehicle_registrations/u);
  assert.match(sql, /create table public\.road_vehicle_registration_events/u);
  assert.match(sql, /plate_number/u);
  assert.match(sql, /plate_jurisdiction/u);
  assert.match(sql, /registered_owner_name/u);
  assert.match(sql, /primary_driver_name/u);
  assert.match(sql, /host_accommodation_id/u);
  assert.match(sql, /valid_from/u);
  assert.match(sql, /valid_until/u);
  assert.match(sql, /registration_status/u);
  assert.match(sql, /vehicle\.read/u);
  assert.match(sql, /vehicle\.register/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /Build 054/u);
  assert.doesNotMatch(sql, /create policy[\s\S]{0,400}vehicle\.pass\.issue/iu);
});

test("Build 053 verification preserves RLS, evidence and direct-role denial", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(sql, /registration events must remain append-only/u);
  assert.match(sql, /vehicle\.read RLS boundary/u);
  assert.match(sql, /vehicle\.register insert boundary/u);
  assert.match(sql, /vehicle\.register update boundary/u);
  assert.match(sql, /anon direct road-vehicle access must remain denied/u);
  assert.match(
    sql,
    /authenticated direct road-vehicle access must remain denied/u,
  );
});

test("Build 053 service serializes plate overlap and uses canonical guest/reservation links", async () => {
  const source = await readFile(serviceUrl, "utf8");

  assert.match(source, /vehicle\.register/u);
  assert.match(source, /guest_vehicle_profiles/u);
  assert.match(source, /pending','confirmed','checked_in/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /plate_jurisdiction/u);
  assert.match(source, /plate_number/u);
  assert.match(source, /overlapping active registration/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /Build 054/u);
  assert.match(source, /Build 056\/063/u);
});

test("Build 053 exposes a vehicle desk with help, channels and successor boundaries", async () => {
  const [page, help, reservations] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(helpUrl, "utf8"),
    readFile(reservationPageUrl, "utf8"),
  ]);

  assert.match(page, /Road Vehicle Registration/u);
  assert.match(page, /helpTopic="vehicle\.registration"/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /Build 054/u);
  assert.match(page, /Build 056\/063/u);
  assert.match(help, /"vehicle\.registration"/u);
  assert.match(reservations, /Open Road Vehicle Registration/u);
});
