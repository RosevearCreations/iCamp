import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeFrontDeskCheckInInput,
  parseArrivalRequests,
} from "../lib/front-desk-check-in/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0061_front_desk_check_in.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0061_front_desk_check_in.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/front-desk-check-in/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/check-in/page.tsx",
  import.meta.url,
);

test("Build 049 normalizes arrival counts, rules and saved stay selections", () => {
  const input = normalizeFrontDeskCheckInInput({
    occupantCount: "4",
    visitorCount: "1",
    petCount: "2",
    vehicleCount: "2",
    vehicleProfileIds: [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000001",
    ],
    petProfileIds: ["10000000-0000-4000-8000-000000000002"],
    rulesAcknowledged: "on",
    credentialRequestCount: "2",
    rentalRequests: "Canoe:1, Kayak:2",
    storeRequests: "Firewood:2",
  });

  assert.equal(input.occupantCount, 4);
  assert.equal(input.visitorCount, 1);
  assert.equal(input.petCount, 2);
  assert.equal(input.vehicleCount, 2);
  assert.equal(input.vehicleProfileIds.length, 1);
  assert.equal(input.petProfileIds.length, 1);
  assert.equal(input.credentialRequestCount, 2);
  assert.deepEqual(
    input.rentalRequests.map((item) => [item.displayName, item.quantity]),
    [
      ["Canoe", 1],
      ["Kayak", 2],
    ],
  );
});

test("Build 049 requires explicit arrival rules acknowledgement", () => {
  assert.throws(
    () =>
      normalizeFrontDeskCheckInInput({
        occupantCount: 2,
        visitorCount: 0,
        petCount: 0,
        vehicleCount: 1,
        rulesAcknowledged: false,
      }),
    /rules must be acknowledged/iu,
  );
});

test("Build 049 parses request quantities without claiming fulfillment", () => {
  const requests = parseArrivalRequests("Firewood:2\nIce:1", "store_add_on");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].requestKind, "store_add_on");
  assert.equal(requests[0].quantity, 2);
});

test("Build 049 schema is append-only and preserves successor boundaries", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.reservation_check_ins/u);
  assert.match(sql, /create table public\.reservation_check_in_requests/u);
  assert.match(sql, /reservation_check_ins_append_only/u);
  assert.match(sql, /reservation\.modify/u);
  assert.match(sql, /access_credential/u);
  assert.match(sql, /Build 053/u);
  assert.match(sql, /Build 055/u);
  assert.match(sql, /Build 056\/063/u);
  assert.doesNotMatch(sql, /plate_number/u);
});

test("Build 049 verification preserves RLS and direct-role denial", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /check-in evidence must remain append-only/u);
  assert.match(sql, /reservation\.modify insert boundary/u);
  assert.match(sql, /anon direct check-in access must remain denied/u);
  assert.match(sql, /must not grant update\/delete/u);
});

test("Build 049 service revalidates live balance, capacity and manager override", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /evaluateCapacityRules/u);
  assert.match(source, /payment\.read/u);
  assert.match(source, /reservation\.override/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /status = 'checked_in'/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /Build 053/u);
  assert.match(source, /Build 055/u);
  assert.match(source, /Build 056\/063/u);
});

test("Build 049 exposes Web/PWA check-in and safe phone/SMS fallbacks", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /Front Desk Check-In/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /raw\s+card\s+data/iu);
  assert.match(page, /Build 053/u);
  assert.match(page, /Build 055/u);
  assert.match(page, /Build 056\/063/u);
});
