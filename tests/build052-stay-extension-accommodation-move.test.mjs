import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateReservationFinancialDelta } from "../lib/reservation-management/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0065_stay_extension_accommodation_move.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0065_stay_extension_accommodation_move.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/reservation-management/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/[reservationId]/page.tsx",
  import.meta.url,
);

test("Build 052 calculates extension and move payment differences without executing money", () => {
  const increase = calculateReservationFinancialDelta({
    previousTotalCents: 45000,
    revisedTotalCents: 52000,
    capturedCents: 20000,
    hasPaymentSchedule: true,
  });
  assert.equal(increase.deltaCents, 7000);
  assert.equal(increase.financialReviewRequired, true);

  const decrease = calculateReservationFinancialDelta({
    previousTotalCents: 52000,
    revisedTotalCents: 48000,
    capturedCents: 20000,
    hasPaymentSchedule: true,
  });
  assert.equal(decrease.deltaCents, -4000);
  assert.equal(decrease.financialReviewRequired, true);
});

test("Build 052 schema keeps in-stay adjustment evidence append-only and scoped", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.reservation_stay_adjustments/u);
  assert.match(sql, /availability_rechecked/u);
  assert.match(sql, /housekeeping_review_required/u);
  assert.match(sql, /maintenance_review_required/u);
  assert.match(sql, /reservation_stay_adjustments_append_only/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /reservation\.modify/u);
});

test("Build 052 verification preserves RLS and direct-role denial", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /stay-adjustment RLS must remain enabled and forced/u);
  assert.match(sql, /stay-adjustment evidence must remain append-only/u);
  assert.match(sql, /reservation\.modify insert boundary/u);
  assert.match(sql, /anon direct stay-adjustment access must remain denied/u);
});

test("Build 052 extends canonical reservation management for checked-in stays", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /"pending", "confirmed", "checked_in"/u);
  assert.match(source, /cannot rewrite its historical arrival date/u);
  assert.match(source, /"accommodation\.manage"/u);
  assert.match(source, /Checked-in accommodation moves require/u);
  assert.match(source, /update public\.reservations/u);
  assert.match(source, /reservation_stay_adjustments/u);
  assert.match(source, /availability_rechecked/u);
  assert.match(source, /housekeepingReviewRequired/u);
  assert.match(source, /maintenanceReviewRequired/u);
  assert.match(source, /appendAuditEvent/u);
});

test("Build 052 Web/PWA surface declares operational and channel handoffs", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /Build 052/u);
  assert.match(page, /Historical arrival is locked after check-in/u);
  assert.match(page, /Recheck availability, reprice & apply/u);
  assert.match(page, /Checked-in stay adjustments/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
});
