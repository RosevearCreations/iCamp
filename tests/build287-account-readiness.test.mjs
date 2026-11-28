import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assessAccount287, databasePin287 } from "../lib/build287/core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const complete = {
  sessionVerified: true,
  querySucceeded: true,
  hostPin: "matches",
  ownerBindingTable: true,
  migrationLedger: true,
  mfaVerified: true,
  mfaRequired: true,
  grantActive: true,
  bindingVerified: true,
};

test("Build 287 host comparison does not infer project identity", () => {
  assert.equal(databasePin287("postgres://db.example/db", "db.example"), "matches");
  assert.equal(databasePin287("postgres://db.example.evil/db", "db.example"), "mismatch");
  assert.equal(databasePin287("https://db.example/db", "db.example"), "mismatch");
  assert.equal(databasePin287("postgres://db.example/db", ""), "unconfigured");
});

test("Build 287 reports independent prerequisites without granting authority", () => {
  assert.equal(assessAccount287(complete), "SELF_ACCESS_PREREQUISITES_PRESENT");
  const cases = [
    ["sessionVerified", false, "HOLD_FRESH_MFA"],
    ["querySucceeded", false, "HOLD_DIAGNOSTIC_UNAVAILABLE"],
    ["hostPin", "mismatch", "HOLD_DATABASE_TARGET"],
    ["ownerBindingTable", false, "HOLD_DATABASE_RECONCILIATION"],
    ["migrationLedger", false, "HOLD_DATABASE_RECONCILIATION"],
    ["mfaVerified", false, "HOLD_MFA_POLICY"],
    ["mfaRequired", false, "HOLD_MFA_POLICY"],
    ["grantActive", false, "HOLD_PLATFORM_GRANT"],
    ["bindingVerified", false, "HOLD_INDEPENDENT_OWNER_REVIEW"],
  ];
  for (const [key, value, expected] of cases)
    assert.equal(assessAccount287({ ...complete, [key]: value }), expected);
});

test("Build 287 self-only inspection requires a fresh actual session and read-only SQL", () => {
  const service = read("lib/build287/postgres.mjs");
  const page = read("app/auth/platform-readiness/page.tsx");
  assert.match(service, /begin read only/u);
  assert.match(service, /s\.id=\$1 and s\.user_id=\$2/u);
  assert.match(service, /s\.revoked_at is null/u);
  assert.match(service, /interval '15 minutes'/u);
  assert.match(service, /o\.verified_by<>o\.user_id/u);
  assert.doesNotMatch(service, /password_hash|provider_reference|insert into|update icamp_private|delete from/iu);
  assert.match(page, /requireStaff\("\/sysop"\)/u);
  assert.match(page, /inspectOwnAccount287\(session\)/u);
  assert.match(page, /session\.assuranceLevel !== "aal2"/u);
});
