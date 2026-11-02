import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  RULE_CATEGORIES,
  normalizeRuleSet,
  normalizeRulePublication,
  normalizeRuleAcknowledgement,
} from "../lib/campground-rules/core.mjs";
const id = "23cb671b-b62a-4353-826d-bda45eb15ca9";
const other = "b87ff38e-2f0b-4cda-8a6b-cd879b77692f";
const migration = fs.readFileSync(
  new URL(
    "../database/migrations/0109_versioned_campground_facility_rules.sql",
    import.meta.url,
  ),
  "utf8",
);
test("campground and six facility categories have strict identifiers", () => {
  assert.deepEqual(RULE_CATEGORIES, [
    "campground",
    "pool",
    "waterfront",
    "sports",
    "playground",
    "event",
    "access",
  ]);
  assert.deepEqual(
    normalizeRuleSet({
      code: "pool_rules",
      title: "Pool safety rules",
      category: "pool",
      facilityId: id,
    }),
    {
      code: "POOL_RULES",
      title: "Pool safety rules",
      category: "pool",
      facilityId: id,
    },
  );
  assert.throws(() =>
    normalizeRuleSet({
      code: "x",
      title: "Pool safety rules",
      category: "pool",
    }),
  );
  assert.throws(() =>
    normalizeRuleSet({
      code: "CAMP",
      title: "Safe campground",
      category: "campground",
      facilityId: id,
    }),
  );
  assert.throws(() =>
    normalizeRuleSet({
      code: "BEACH",
      title: "Beach rules",
      category: "untrusted",
    }),
  );
});
test("published versions have exact content, version expectation and retry ID", () => {
  const valid = {
    ruleSetId: id,
    clientPublicationId: other,
    expectedVersion: 0,
    content: "Always supervise children in the pool enclosure.",
    acknowledgementRequired: true,
  };
  assert.equal(normalizeRulePublication(valid).acknowledgementRequired, true);
  assert.throws(() =>
    normalizeRulePublication({ ...valid, expectedVersion: -1 }),
  );
  assert.throws(() =>
    normalizeRulePublication({ ...valid, content: "Too short" }),
  );
  assert.throws(() =>
    normalizeRulePublication({ ...valid, clientPublicationId: "retry" }),
  );
});
test("guest acceptance references a real reservation and immutable version", () => {
  assert.equal(
    normalizeRuleAcknowledgement({
      reservationId: id,
      ruleSetId: other,
      ruleVersionId: id,
    }).ruleVersionId,
    id,
  );
  assert.throws(() =>
    normalizeRuleAcknowledgement({
      reservationId: "wrong",
      ruleSetId: other,
      ruleVersionId: id,
    }),
  );
});
test("SQL forces scoped RLS, exact acknowledgement and append-only histories", () => {
  assert.equal((migration.match(/force row level security/g) ?? []).length, 3);
  assert.match(migration, /unique\(rule_version_id,reservation_id\)/);
  assert.match(migration, /guest_user_id=new.guest_user_id/);
  assert.match(migration, /current_setting\('icamp.user_id'/);
  assert.match(migration, /campground_rule_ack_immutable/);
  assert.match(migration, /campground_rule_version_immutable/);
  assert.match(migration, /new.version_number<>latest\+1/);
  assert.match(migration, /status in \('confirmed','checked_in'\)/);
});
test("guest rule visibility depends on an owned confirmed stay, not staff permissions", () => {
  const guestPolicy = fs.readFileSync(
    new URL(
      "../database/migrations/0111_build082_guest_reservation_rls.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(guestPolicy, /reservations_guest_owned_active_read/);
  assert.match(guestPolicy, /for select to icamp_app/);
  assert.match(guestPolicy, /guest_user_id=nullif/);
  assert.match(guestPolicy, /status in \('confirmed','checked_in'\)/);
  assert.doesNotMatch(
    guestPolicy,
    /grant .* to authenticated|for update|for insert/,
  );
  const consolidated = fs.readFileSync(
    new URL(
      "../database/migrations/0112_build082_guest_rls_policy_consolidation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(consolidated, /alter policy reservations_read/);
  assert.match(consolidated, /guest_user_id=nullif/);
  assert.match(
    consolidated,
    /drop policy reservations_guest_owned_active_read/,
  );
});
test("app writes no booking, payment or safety enforcement side effects", () => {
  const source = fs.readFileSync(
    new URL("../lib/campground-rules/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /update public\.reservations|update public\.access_|insert into public\.reservation_payments|payment\.capture/,
  );
  assert.match(source, /campground\.rules\.publish/);
  assert.match(
    source,
    /on conflict\(rule_version_id,reservation_id\) do nothing/,
  );
});
