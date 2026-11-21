import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  normalizeStage269,
  normalizeSlaReceipt269,
  verifySignedRaw269,
  trafficFreshness269,
  restoreWitnessStatus269,
} from "../lib/campground-pilot269/core.mjs";
const now = Date.parse("2026-11-21T15:00:00Z");
const payload = {
  campgroundId: "11111111-1111-4111-8111-111111111111",
  sourceId: "camp_rosevear_web",
  nonce: "signedoriginalnonce1234",
  stage: "guest_search",
  observedAt: "2026-11-21T14:59:30Z",
  requests: 50,
  errors: 3,
  latencyP95Ms: 450,
};
test("Original four-stage traffic preserves source, stage, counts and freshness", () => {
  assert.equal(normalizeStage269(payload, now).requests, 50);
  for (const changed of [
    { ...payload, errors: 51 },
    { ...payload, requests: 12.5 },
    { ...payload, stage: "customer_name" },
    { ...payload, nonce: "bad" },
    { ...payload, observedAt: "2026-11-21T14:55:00Z" },
    { ...payload, guestEmail: "private@example.test" },
  ])
    assert.throws(() => normalizeStage269(changed, now));
});
test("Provider acknowledged delivery is signed, fresh and scoped", () => {
  const message = {
    outboxId: "11111111-1111-4111-8111-111111111111",
    sourceId: "comms_hub_receiver",
    providerEventId: "provider-event-001",
    nonce: "uniqueprovideracknonce1",
    eventKind: "delivered",
    observedAt: "2026-11-21T14:59:40Z",
  };
  assert.equal(normalizeSlaReceipt269(message, now).eventKind, "delivered");
  assert.throws(() =>
    normalizeSlaReceipt269(
      { ...message, guestEmail: "private@example.test" },
      now,
    ),
  );
  assert.throws(() =>
    normalizeSlaReceipt269(
      { ...message, observedAt: "2026-11-21T14:40:00Z" },
      now,
    ),
  );
  const secret = "test-only-do-not-reuse-secret-1234567890";
  const body = JSON.stringify(message);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifySignedRaw269(body, signature, secret), true);
  assert.equal(verifySignedRaw269(body + " ", signature, secret), false);
  assert.equal(verifySignedRaw269(body, signature, "short"), false);
});
test("No probes mistaken for guest traffic; quiet seasonal tenant is not outage", () => {
  assert.equal(
    trafficFreshness269(
      {
        campgroundState: "inactive",
        enrollmentState: "active",
        lastReceivedAt: null,
      },
      now,
    ),
    "SEASONAL_PAUSE_OR_INACTIVE",
  );
  assert.equal(
    trafficFreshness269(
      {
        campgroundState: "active",
        enrollmentState: "active",
        lastReceivedAt: null,
      },
      now,
    ),
    "NO_SIGNED_SAMPLES",
  );
  assert.equal(
    trafficFreshness269(
      {
        campgroundState: "active",
        enrollmentState: "active",
        lastReceivedAt: "2026-11-21T14:20:00Z",
      },
      now,
    ),
    "STALE",
  );
});
test("Independent restore needs two distinct actors on same original backup", () => {
  const d = "a".repeat(64);
  const r = [
    { kind: "original_backup", digest: d, actorId: "ownerA" },
    { kind: "isolated_restore", digest: d, actorId: "ownerA" },
  ];
  assert.match(restoreWitnessStatus269(r), /^HOLD/);
  assert.match(
    restoreWitnessStatus269([
      ...r,
      { kind: "independent_review", digest: d, actorId: "ownerB" },
    ]),
    /^TWO_PERSON/,
  );
  assert.match(
    restoreWitnessStatus269([
      ...r,
      { kind: "independent_review", digest: d, actorId: "ownerA" },
    ]),
    /^HOLD/,
  );
});
test("Postgres v0244 enforces FORCE RLS, append-only receipts and two actors", () => {
  const sql = readFileSync(
    "database/migrations/0244_build269_live_pilot_witness.sql",
    "utf8",
  );
  for (const part of [
    "traffic_stage269",
    "support_delivery_receipts269",
    "pilot_restore_witness269",
    "pilot_booking_witness269",
    "force row level security",
    "w.actor_user_id<>new.actor_user_id",
    "state='active'",
  ])
    assert.ok(sql.includes(part), part);
});
