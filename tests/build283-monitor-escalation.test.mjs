import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authorizedMonitor283,
  closureEligible283,
  escalationDecision283,
} from "../lib/build283/core.mjs";

test("scheduler requires explicit production opt-in and bearer secret", () => {
  const secret = "synthetic-monitor-test-credential-only";
  const env = {
    VERCEL_ENV: "production",
    ICAMP283_MONITOR_ENABLED: "true",
    ICAMP283_MONITOR_SECRET: secret,
  };
  assert.equal(authorizedMonitor283("Bearer " + secret, env), true);
  assert.equal(authorizedMonitor283("Bearer wrong", env), false);
  assert.equal(
    authorizedMonitor283("Bearer " + secret, { ...env, VERCEL_ENV: "preview" }),
    false,
  );
});

test("automatic escalation is capped, cooled down and stops on receipt", () => {
  const state = { attempts: 0, now: 7200000 };
  assert.equal(escalationDecision283(state), "ELIGIBLE");
  assert.equal(
    escalationDecision283({ ...state, attempts: 1, lastAttemptAt: 7199999 }),
    "RETRY_COOLDOWN",
  );
  assert.equal(
    escalationDecision283({ ...state, attempts: 3 }),
    "INDEPENDENT_REVIEW_REQUIRED",
  );
  assert.equal(
    escalationDecision283({ ...state, deliveryExists: true }),
    "NO_AUTOMATIC_RESUBMISSION",
  );
});

test("closure requires a newer verified recovery on the same source and key", () => {
  const previous = {
    id: "old",
    providerId: "provider",
    fingerprint: "key",
    sourceHost: "source",
  };
  const current = { ...previous, id: "new", verified: true, recordedAt: 200 };
  const state = { delivery: true, previous, current, openedAt: 100 };
  assert.equal(closureEligible283(state), true);
  assert.equal(closureEligible283({ ...state, delivery: false }), false);
  assert.equal(
    closureEligible283({ ...state, current: { ...current, sourceHost: "other" } }),
    false,
  );
  assert.equal(
    closureEligible283({ ...state, current: { ...current, id: "old" } }),
    false,
  );
});
