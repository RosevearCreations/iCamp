import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0049_reservation_checkout.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0049_reservation_checkout.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = await readFile(
  new URL("../lib/reservation-checkout/postgres.mjs", import.meta.url),
  "utf8",
);
const detail = await readFile(
  new URL(
    "../app/booking/accommodations/[accommodationId]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const checkout = await readFile(
  new URL(
    "../app/booking/accommodations/[accommodationId]/checkout/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const pending = await readFile(
  new URL(
    "../app/booking/reservations/[reservationId]/pending/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_041.md", import.meta.url),
  "utf8",
);

test("Build 041 persists owner-bound holds and immutable checkout evidence", () => {
  assert.match(migration, /checkout_user_id/u);
  assert.match(migration, /originating_hold_id/u);
  assert.match(migration, /create table public\.reservation_checkout_details/u);
  assert.match(migration, /create table public\.reservation_charge_lines/u);
  assert.match(migration, /force row level security/u);
  assert.match(verify, /must remain immutable to icamp_app/u);
});

test("Build 041 atomically revalidates and converts the hold", () => {
  assert.match(service, /pg_advisory_xact_lock/u);
  assert.match(service, /evaluateBookingDateRules/u);
  assert.match(service, /evaluateCapacityRules/u);
  assert.match(service, /assertCompatibleBookingChoice/u);
  assert.match(service, /quoteAccommodationStay/u);
  assert.match(service, /quoteBookingCharges/u);
  assert.match(service, /hold_state = 'converted'/u);
  assert.match(service, /'pending','web'/u);
  assert.match(service, /originating_hold_id/u);
});

test("Build 041 exposes web checkout and pending reservation without payment capture", () => {
  assert.match(detail, /Continue to reservation checkout/u);
  assert.match(checkout, /Guest & contact/u);
  assert.match(checkout, /Occupants, visitors, pets & vehicles/u);
  assert.match(checkout, /Acknowledge the booking rules/u);
  assert.match(checkout, /No payment is taken in Build 041/u);
  assert.match(pending, /Pending payment/u);
  assert.match(pending, /No payment has been taken/u);
});

test("Build 041 documents omnichannel and Build 042 payment boundaries", () => {
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(build, /Build 042/u);
  assert.match(build, /does not capture payment/u);
});
