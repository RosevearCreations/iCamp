import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoveries284,
  relayEnvironment284,
  schedulerAuthorized284,
} from "../lib/build284/core.mjs";

test("scheduler remains disabled outside explicitly authorized production", () => {
  const env = {
    VERCEL_ENV: "production",
    ICAMP284_SCHEDULER_ENABLED: "true",
    ICAMP284_SCHEDULER_SECRET: "x".repeat(40),
  };
  assert.equal(schedulerAuthorized284("Bearer " + "x".repeat(40), env), true);
  assert.equal(schedulerAuthorized284("Bearer wrong", env), false);
  assert.equal(schedulerAuthorized284("Bearer " + "x".repeat(40), {}), false);
});

test("discovery distinguishes missing readback from witnessed HOLD", () => {
  const state = {
    admission: { adopted: true, host: { pinned: true } },
    monitoring: {},
    sourceCount: 0,
  };
  assert.equal(discoveries284(state, "verified-ack").length, 4);
  assert.deepEqual(discoveries284(state, null), []);
  assert.deepEqual(
    discoveries284(
      { ...state, status: "HOLD_ORIGINAL_PROVIDER_MFA_MONITOR_READBACK" },
      "verified-ack",
    ),
    [],
  );
});

test("secondary relay requires separately configured shared idempotency", () => {
  const env = {
    ICAMP284_RELAY_ENABLED: "true",
    ICAMP284_SHARED_IDEMPOTENCY_CONFIRMED: "true",
    ICAMP282_ALERT_URL: "https://primary.example.com/alert",
    ICAMP282_ALERT_TOKEN: "synthetic-primary",
    ICAMP284_RELAY_URL: "https://relay.example.com/alert",
    ICAMP284_RELAY_TOKEN: "synthetic-secondary",
  };
  assert.equal(relayEnvironment284(env, 0).channel, "PRIMARY");
  assert.equal(relayEnvironment284(env, 1).channel, "SECONDARY_RELAY");
  assert.equal(relayEnvironment284({}, 1).channel, "PRIMARY");
  assert.throws(() =>
    relayEnvironment284({ ...env, ICAMP284_RELAY_URL: env.ICAMP282_ALERT_URL }, 1),
  );
});
