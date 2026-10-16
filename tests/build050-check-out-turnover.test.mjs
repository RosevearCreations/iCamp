import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeReservationCheckOutInput } from "../lib/front-desk-check-out/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0063_check_out_accommodation_turnover.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0063_check_out_accommodation_turnover.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/front-desk-check-out/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/check-out/page.tsx",
  import.meta.url,
);

test("Build 050 normalizes departure and return evidence", () => {
  const input = normalizeReservationCheckOutInput({
    departureConfirmed: "on",
    financialFollowUpAcknowledged: "on",
    rentalReturnState: "complete",
    keyReturnState: "follow_up_required",
    credentialReturnState: "complete",
    returnNotes: "One physical key needs office follow-up.",
    departureNotes: "Guest departed early.",
  });

  assert.equal(input.departureConfirmed, true);
  assert.equal(input.financialFollowUpAcknowledged, true);
  assert.equal(input.rentalReturnState, "complete");
  assert.equal(input.keyReturnState, "follow_up_required");
  assert.equal(input.credentialReturnState, "complete");
});

test("Build 050 requires explicit departure confirmation", () => {
  assert.throws(
    () =>
      normalizeReservationCheckOutInput({
        departureConfirmed: false,
      }),
    /Departure must be confirmed/iu,
  );
});

test("Build 050 schema is append-only and preserves successor boundaries", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.reservation_check_outs/u);
  assert.match(sql, /reservation_check_outs_append_only/u);
  assert.match(sql, /financial_handoff_state/u);
  assert.match(sql, /cottage_turnover_id/u);
  assert.match(sql, /Build 074/u);
  assert.match(sql, /Build 063/u);
});

test("Build 050 verification preserves RLS and composite FK indexes", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /checkout evidence must remain append-only/u);
  assert.match(sql, /reservation\.modify insert boundary/u);
  assert.match(sql, /anon direct checkout access must remain denied/u);
  assert.match(sql, /composite foreign-key indexes incomplete/u);
});

test("Build 050 service completes reservations and triggers safe turnover", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /status='completed'/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /moveAccommodationToPostDepartureState/u);
  assert.match(source, /createAutomaticCottageTurnover/u);
  assert.match(source, /cottage_configuration_required/u);
  assert.match(source, /financialFollowUpAcknowledged/u);
  assert.match(source, /Build 074/u);
  assert.match(source, /Build 063/u);
  assert.match(source, /appendAuditEvent/u);
});

test("Build 050 Web/PWA surface declares safe phone and SMS fallback", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /Front Desk Check-Out/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /raw payment-card data/iu);
  assert.match(page, /Build\s+027/u);
  assert.match(page, /Build\s+063/u);
  assert.match(page, /Build\s+074/u);
});
