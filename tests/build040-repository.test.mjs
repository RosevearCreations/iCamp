import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0048_add_ons_passes_service_fees.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0048_add_ons_passes_service_fees.sql",
    import.meta.url,
  ),
  "utf8",
);
const detail = await readFile(
  new URL("../lib/public-accommodation-detail/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/booking/accommodations/[accommodationId]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_040.md", import.meta.url),
  "utf8",
);

test("Build 040 persists a protected canonical booking charge catalog", () => {
  assert.match(migration, /create table public\.booking_charge_catalog/u);
  assert.match(migration, /'add_on'.*'pass'.*'service_fee'/su);
  assert.match(
    migration,
    /'per_stay'.*'per_night'.*'per_unit'.*'percent_of_stay'/su,
  );
  assert.match(migration, /tax_category_code/u);
  assert.match(migration, /fee_category_code/u);
  assert.match(migration, /force row level security/u);
  assert.match(verify, /must not be deletable by icamp_app/u);
});

test("Build 040 connects canonical charges to public accommodation detail", () => {
  assert.match(detail, /public\.booking_charge_catalog/u);
  assert.match(detail, /quoteBookingCharges/u);
  assert.match(detail, /bookingChargePriceLabel/u);
  assert.match(page, /Optional extras, passes & service fees/u);
  assert.match(page, /Automatic service fees/u);
});

test("Build 040 preserves checkout, hold and payment boundaries", () => {
  assert.match(build, /Build 041/u);
  assert.match(build, /Build 042/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
});
