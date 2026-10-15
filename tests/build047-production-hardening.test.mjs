import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeLongTermAssignment,
  normalizeSourceChannel,
} from "../lib/long-term-assignment/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0058_build047_production_hardening.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0058_build047_production_hardening.sql",
  import.meta.url,
);
const serviceUrl = new URL(
  "../lib/long-term-assignment/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/seasonal/page.tsx",
  import.meta.url,
);

test("Build 047 derives package charges server-side for the operator UI", () => {
  const value = normalizeLongTermAssignment({
    accommodationId: "site-1",
    assignmentKind: "seasonal",
    occupantDisplayName: "Seasonal Guest",
    startsOn: "2027-05-01",
    endsOn: "2027-10-15",
    ratePlanId: "plan-1",
    chargeDueOn: "2027-05-01",
    winterizationRequired: true,
  });

  assert.equal(value.chargeAmountCents, null);
  assert.equal(value.currencyCode, null);
  assert.equal(value.winterizationRequired, true);
  assert.equal(normalizeSourceChannel("SMS"), "sms");
});

test("Build 047 hardening uses seasonal.manage, immutable evidence and permanent-unit pricing", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /seasonal\.manage/u);
  assert.match(sql, /permanent_unit/u);
  assert.match(sql, /seasonal_assignments_guard_identity/u);
  assert.match(sql, /seasonal_assignment_events_append_only/u);
  assert.match(sql, /winterization_required/u);
  assert.match(sql, /source_channel/u);
});

test("Build 047 hardening verification covers RLS, direct access and Build 035 continuity", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /lifecycle evidence must remain append-only/u);
  assert.match(sql, /seasonal\.manage assignment policy missing/u);
  assert.match(sql, /permanent-unit rate-plan integration missing/u);
  assert.match(sql, /Build 035 seasonal availability authority missing/u);
  assert.match(sql, /authenticated direct lifecycle access must remain denied/u);
});

test("Build 047 service supports campsites and permanent units with audit and optimistic lifecycle updates", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /campsite','permanent_unit/u);
  assert.match(source, /seasonal\.manage/u);
  assert.match(source, /canonicalAmount/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /expectedRowVersion/u);
});

test("Build 047 exposes a discoverable Web/PWA long-term operator surface and safe phone/SMS fallbacks", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /Seasonal & yearly assignment foundation/u);
  assert.match(page, /permanent units/u);
  assert.match(page, /Winter close/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /Raw payment-card details are never accepted/u);
});
