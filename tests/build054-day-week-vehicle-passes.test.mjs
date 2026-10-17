import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  effectiveVehiclePassStatus,
  normalizeNonStayVehiclePassInput,
  normalizeVehiclePassPolicyInput,
} from "../lib/vehicle-pass/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0068_day_week_vehicle_passes_extra_vehicle_fees.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0068_day_week_vehicle_passes_extra_vehicle_fees.sql",
  import.meta.url,
);
const serviceUrl = new URL("../lib/vehicle-pass/postgres.mjs", import.meta.url);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/vehicles/passes/page.tsx",
  import.meta.url,
);
const helpUrl = new URL("../lib/help/topics.ts", import.meta.url);
const parityUrl = new URL("../lib/parity/core.mjs", import.meta.url);
const roadVehiclePageUrl = new URL(
  "../app/workspaces/management/campgrounds/vehicles/page.tsx",
  import.meta.url,
);

test("Build 054 normalizes non-stay vehicle passes and limits duration", () => {
  const value = normalizeNonStayVehiclePassInput({
    passKind: "day",
    plateNumber: " abc-123 ",
    plateJurisdiction: " on ",
    vehicleDescription: "Blue pickup",
    driverName: "Jamie Camper",
    validFromLocal: "2027-07-01T08:00",
    validUntilLocal: "2027-07-01T20:00",
    notes: "Day-use parking.",
  });

  assert.equal(value.passKind, "day");
  assert.equal(value.plateNumber, "ABC-123");
  assert.equal(value.plateJurisdiction, "ON");

  assert.throws(
    () =>
      normalizeNonStayVehiclePassInput({
        ...value,
        passKind: "day",
        validFromLocal: "2027-07-01T08:00",
        validUntilLocal: "2027-07-02T09:00",
      }),
    /cannot exceed 24 hours/iu,
  );

  assert.throws(
    () =>
      normalizeNonStayVehiclePassInput({
        ...value,
        passKind: "week",
        validFromLocal: "2027-07-01T08:00",
        validUntilLocal: "2027-07-08T09:00",
      }),
    /cannot exceed 7 days/iu,
  );
});

test("Build 054 normalizes policy and computes effective pass status", () => {
  const policy = normalizeVehiclePassPolicyInput({
    dayPassChargeId: "charge-day",
    weekPassChargeId: "",
    extraVehicleChargeId: "charge-extra",
    includedStayVehicleCount: "2",
    parkingRule: "Use visitor parking.",
    accessRule: "No vehicle access after 11 PM.",
  });

  assert.equal(policy.includedStayVehicleCount, 2);
  assert.equal(policy.weekPassChargeId, null);

  assert.equal(
    effectiveVehiclePassStatus({
      passStatus: "active",
      validFrom: "2027-07-01T14:00:00Z",
      validUntil: "2027-07-01T22:00:00Z",
      now: "2027-07-01T13:00:00Z",
    }),
    "scheduled",
  );
  assert.equal(
    effectiveVehiclePassStatus({
      passStatus: "active",
      validFrom: "2027-07-01T14:00:00Z",
      validUntil: "2027-07-01T22:00:00Z",
      now: "2027-07-01T23:00:00Z",
    }),
    "expired",
  );
});

test("Build 054 schema uses canonical charges, payment evidence and strict RLS", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.campground_vehicle_pass_policies/u);
  assert.match(sql, /create table public\.vehicle_passes/u);
  assert.match(sql, /create table public\.vehicle_pass_events/u);
  assert.match(sql, /create table public\.vehicle_pass_payments/u);
  assert.match(
    sql,
    /create table icamp_private\.vehicle_pass_payment_provider_events/u,
  );
  assert.match(sql, /booking_charge_catalog/u);
  assert.match(sql, /Vehicle pass fee snapshot must match/u);
  assert.match(sql, /vehicle\.pass\.issue/u);
  assert.match(sql, /payment_state is trusted-server managed/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /road_vehicle_registrations_read/u);
  assert.match(sql, /reservations_read/u);
  assert.match(sql, /Build 056\+/u);
  assert.match(sql, /Build 060/u);
});

test("Build 054 verification protects evidence and direct database roles", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(
    sql,
    /vehicle pass payments must remain trusted-server write only/u,
  );
  assert.match(sql, /vehicle pass events must remain append-only/u);
  assert.match(sql, /vehicle pass provider events must remain private/u);
  assert.match(sql, /anon direct vehicle-pass access must remain denied/u);
  assert.match(
    sql,
    /authenticated direct vehicle-pass access must remain denied/u,
  );
  assert.match(
    sql,
    /vehicle pass issuer must be able to read Build 053 road registrations/u,
  );
  assert.match(
    sql,
    /vehicle pass issuer must be able to read required reservation facts/u,
  );
});

test("Build 054 service serializes passes, enforces included vehicles and activates on capture", async () => {
  const source = await readFile(serviceUrl, "utf8");

  assert.match(source, /vehicle\.pass\.issue/u);
  assert.match(source, /payment\.capture/u);
  assert.match(source, /booking_charge_catalog/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /active_vehicle_count/u);
  assert.match(source, /includedStayVehicleCount/u);
  assert.match(source, /pending_payment/u);
  assert.match(source, /payment_captured/u);
  assert.match(source, /provider\.createPayment/u);
  assert.match(source, /provider\.capturePayment/u);
  assert.match(source, /vehicle_pass_payment_provider_events/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /credentialBoundary: "Build 056\/063"/u);
  assert.match(source, /accessRuleBoundary: "Build 060"/u);
});

test("Build 054 exposes pass desk, help, parity and Build 053 navigation", async () => {
  const [page, help, parity, roadVehiclePage] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(helpUrl, "utf8"),
    readFile(parityUrl, "utf8"),
    readFile(roadVehiclePageUrl, "utf8"),
  ]);

  assert.match(page, /Day\/Week Vehicle Passes & Extra-Vehicle Fees/u);
  assert.match(page, /helpTopic="vehicle\.passes"/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /Build 056/u);
  assert.match(page, /Build 060/u);
  assert.match(help, /"vehicle\.passes"/u);
  assert.match(parity, /id: "vehicle\.pass\.issue"/u);
  assert.match(parity, /secureLinkPurpose: "vehicle-pass-payment"/u);
  assert.match(roadVehiclePage, /Open Vehicle Passes & Fees/u);
});
