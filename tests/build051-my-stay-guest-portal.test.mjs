import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  myStayPhase,
  normalizeMyStayHandoffUrl,
  normalizeMyStaySettingsInput,
} from "../lib/my-stay/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0064_my_stay_guest_portal.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0064_my_stay_guest_portal.sql",
  import.meta.url,
);
const serviceUrl = new URL("../lib/my-stay/postgres.mjs", import.meta.url);
const guestPageUrl = new URL("../app/guest/stay/page.tsx", import.meta.url);
const configPageUrl = new URL(
  "../app/workspaces/management/campgrounds/guest-experience/page.tsx",
  import.meta.url,
);

test("Build 051 normalizes safe My Stay links and guidance", () => {
  const value = normalizeMyStaySettingsInput({
    guestRulesSummary: "Quiet hours after 11 PM.",
    wifiNetworkName: "CampGuest",
    wifiAccessInstructions: "Ask the office for the current guest password.",
    assistanceInstructions: "Call the office for help.",
    storeUrl: "/store",
    rentalsUrl: "https://example.com/rentals",
  });

  assert.equal(value.storeUrl, "/store");
  assert.equal(value.rentalsUrl, "https://example.com/rentals");
  assert.equal(value.eventsUrl, null);
  assert.throws(
    () => normalizeMyStayHandoffUrl("javascript:alert(1)", "events"),
    /HTTP or HTTPS/u,
  );
});

test("Build 051 derives guest stay phases", () => {
  assert.equal(
    myStayPhase({
      status: "checked_in",
      arrivalDate: "2026-10-15",
      departureDate: "2026-10-18",
      localDate: "2026-10-16",
    }),
    "in_stay",
  );
  assert.equal(
    myStayPhase({
      status: "confirmed",
      arrivalDate: "2026-10-20",
      departureDate: "2026-10-22",
      localDate: "2026-10-16",
    }),
    "upcoming",
  );
});

test("Build 051 schema protects guest-facing campground configuration", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /campground_my_stay_settings/u);
  assert.match(sql, /guest_user_id/u);
  assert.match(sql, /status in \('confirmed','checked_in'\)/u);
  assert.match(sql, /campground\.configuration/u);
  assert.match(sql, /Build 121/u);
  assert.match(sql, /Builds 112-116/u);
  assert.match(sql, /Builds 078-079/u);
});

test("Build 051 verification preserves direct-role denial and actor indexes", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /guest stay-scoped read policy missing/u);
  assert.match(sql, /anon direct My Stay settings access must remain denied/u);
  assert.match(
    sql,
    /authenticated direct My Stay settings access must remain denied/u,
  );
  assert.match(sql, /actor foreign-key indexes incomplete/u);
});

test("Build 051 service scopes stay detail to canonical guest ownership", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /r\.guest_user_id=\$2/u);
  assert.match(source, /reservation_check_ins/u);
  assert.match(source, /reservation_check_outs/u);
  assert.match(source, /reservation_receipts/u);
  assert.match(source, /booking_rules_snapshot/u);
  assert.match(source, /campground_my_stay_settings/u);
  assert.match(source, /appendAuditEvent/u);
});

test("Build 051 guest portal covers required experience and channel parity", async () => {
  const page = await readFile(guestPageUrl, "utf8");
  assert.match(page, /My Stay/u);
  assert.match(page, /Map, rules & Wi-Fi/u);
  assert.match(page, /Campground store/u);
  assert.match(page, /Equipment rentals/u);
  assert.match(page, /Local interests/u);
  assert.match(page, /Assistance/u);
  assert.match(page, /receipts/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
});

test("Build 051 exposes campground-manager configuration without stealing future domains", async () => {
  const page = await readFile(configPageUrl, "utf8");
  assert.match(page, /campground\.configuration/u);
  assert.match(page, /Build 078/u);
  assert.match(page, /Builds 097–106/u);
  assert.match(page, /Builds 112–116/u);
  assert.match(page, /Build 121/u);
});
