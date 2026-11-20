import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeTelemetry267,
  verifyTelemetrySignature267,
} from "../lib/campground-support267/postgres.mjs";

const campgroundId = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-11-19T22:13:00Z");
const sample = {
  campgroundId,
  sourceId: "campground_web_01",
  nonce: "originalnonce0123456789",
  observedAt: "2026-11-19T22:12:30Z",
  requests: 125,
  errors: 4,
  latencyP95Ms: 213,
};
test("Build267 validates only original bounded, fresh scoped numeric telemetry", () => {
  assert.equal(normalizeTelemetry267(sample, now).requests, 125);
  assert.throws(() => normalizeTelemetry267({ ...sample, errors: 126 }, now));
  assert.throws(() => normalizeTelemetry267({ ...sample, requests: -1 }, now));
  assert.throws(() => normalizeTelemetry267({ ...sample, requests: 1.5 }, now));
  assert.throws(() =>
    normalizeTelemetry267({ ...sample, sourceId: "bad" }, now),
  );
  assert.throws(() =>
    normalizeTelemetry267(
      { ...sample, observedAt: "2026-11-19T22:09:00Z" },
      now,
    ),
  );
});
test("Build267 HMAC admission rejects absent, short, wrong and malformed signatures", () => {
  const secret = "this-is-a-test-only-credential-with-adequate-length";
  const body = JSON.stringify(sample);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyTelemetrySignature267(body, signature, secret), true);
  assert.equal(
    verifyTelemetrySignature267(body + " ", signature, secret),
    false,
  );
  assert.equal(verifyTelemetrySignature267(body, signature, "short"), false);
  assert.equal(verifyTelemetrySignature267(body, "bad", secret), false);
});
test("Build267 schema keeps tenant consent, guarded ownership and append-only receipts", () => {
  const migration = readFileSync(
    "database/migrations/0242_build267_support_telemetry.sql",
    "utf8",
  );
  assert.match(migration, /guard_support_ownership267/);
  assert.match(migration, /guard_telemetry_enrollment267/);
  assert.match(migration, /guard_telemetry_samples267/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /support_events267/);
  assert.match(migration, /unique\(campground_id,source_id,nonce\)/);
});
