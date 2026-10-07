import assert from "node:assert/strict";
import test from "node:test";

import { transitionIvrState } from "../lib/voice/ivr.mjs";

test("Build 010 IVR foundation repeats and transfers without numeric bindings", () => {
  const repeat = transitionIvrState({
    stateKey: "main_menu",
    eventType: "repeat",
  });

  assert.deepEqual(repeat, {
    fromState: "main_menu",
    toState: "main_menu",
    action: "prompt.main",
    eventType: "repeat",
    retryCount: 0,
    sessionState: "active",
  });

  const transfer = transitionIvrState({
    stateKey: "main_menu",
    eventType: "staff_transfer",
  });

  assert.equal(transfer.toState, "staff_transfer");
  assert.equal(transfer.action, "transfer.staff");
  assert.equal(transfer.sessionState, "transferred");
});

test("Build 010 IVR timeout retries are bounded and fall back to staff", () => {
  const first = transitionIvrState({
    stateKey: "main_menu",
    eventType: "timeout",
    retryCount: 0,
    maxRetries: 3,
  });

  assert.equal(first.retryCount, 1);
  assert.equal(first.sessionState, "active");

  const final = transitionIvrState({
    stateKey: "main_menu",
    eventType: "timeout",
    retryCount: 2,
    maxRetries: 3,
  });

  assert.equal(final.retryCount, 3);
  assert.equal(final.action, "transfer.staff");
  assert.equal(final.sessionState, "transferred");
});

test("Build 010 unknown semantic IVR events fail safe to repeat", () => {
  const result = transitionIvrState({
    stateKey: "main_menu",
    eventType: "unrecognized",
  });

  assert.equal(result.action, "prompt.repeat");
  assert.equal(result.toState, "main_menu");
  assert.equal(result.sessionState, "active");
});


test("Build 011 entry-state semantic timeout remains bounded", () => {
  const first = transitionIvrState({
    stateKey: "site_entry",
    eventType: "timeout",
    retryCount: 0,
    maxRetries: 3,
  });

  assert.equal(first.toState, "site_entry");
  assert.equal(first.action, "prompt.site");
  assert.equal(first.retryCount, 1);

  const final = transitionIvrState({
    stateKey: "pass_entry",
    eventType: "timeout",
    retryCount: 2,
    maxRetries: 3,
  });

  assert.equal(final.toState, "staff_transfer");
  assert.equal(final.action, "transfer.staff");
  assert.equal(final.sessionState, "transferred");
});
