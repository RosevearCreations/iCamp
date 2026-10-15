import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/0053_reservation_management_console.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0053_reservation_management_console.sql",
  import.meta.url,
);
const repositoryUrl = new URL(
  "../lib/reservation-management/postgres.mjs",
  import.meta.url,
);
const consolePageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/page.tsx",
  import.meta.url,
);
const detailPageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/[reservationId]/page.tsx",
  import.meta.url,
);

test("Build 044 schema keeps current state and append-only change history", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.reservation_management_state/u);
  assert.match(sql, /create table public\.reservation_change_history/u);
  assert.match(sql, /reservation_change_history_append_only/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /reservations_move_bump_availability_revision/u);
  assert.doesNotMatch(
    sql,
    /grant[^;]*(?:update|delete)[^;]*reservation_change_history/iu,
  );
});

test("Build 044 verification checks RLS, append-only history and move revisions", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(sql, /must FORCE RLS/u);
  assert.match(sql, /must remain append-only/u);
  assert.match(sql, /reservation move availability revision trigger/u);
});

test("Build 044 repository reuses pricing and records audit/history without refunds", async () => {
  const source = await readFile(repositoryUrl, "utf8");

  assert.match(source, /quoteAccommodationStay/u);
  assert.match(source, /quoteBookingCharges/u);
  assert.match(source, /reservation_change_history/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /reservation\.management\.cancel/u);
  assert.match(source, /refundExecuted:\s*false/u);
  assert.doesNotMatch(source, /refundPayment|issueRefund|providerRefund/iu);
});

test("Build 044 exposes create/edit/move/fees/cancel and complete history UI", async () => {
  const [consolePage, detailPage] = await Promise.all([
    readFile(consolePageUrl, "utf8"),
    readFile(detailPageUrl, "utf8"),
  ]);

  assert.match(consolePage, /Reservation management console/u);
  assert.match(consolePage, /Create reservation/u);
  assert.match(detailPage, /Edit \/ move \/ extend \/ shorten/u);
  assert.match(detailPage, /Fees & add-ons/u);
  assert.match(detailPage, /Cancel reservation — no refund/u);
  assert.match(detailPage, /Append-only reservation changes/u);
  assert.match(detailPage, /IVR\/DTMF/u);
  assert.match(detailPage, /SMS\/MMS/u);
});
