import assert from "node:assert/strict";
import test from "node:test";

import {
  maskDtmfDigits,
  normalizeDtmfProviderInput,
  routeDtmfInput,
  summarizeDtmfInput,
} from "../lib/voice/dtmf.mjs";

test("Build 011 short menu supports site, reservation, pass, repeat, main and staff", () => {
  const site = routeDtmfInput({ stateKey: "main_menu", digits: "1" });
  assert.equal(site.toState, "site_entry");
  assert.equal(site.action, "prompt.site");

  const reservation = routeDtmfInput({
    stateKey: "main_menu",
    digits: "2",
  });
  assert.equal(reservation.toState, "reservation_entry");

  const pass = routeDtmfInput({ stateKey: "main_menu", digits: "3" });
  assert.equal(pass.toState, "pass_entry");

  const repeat = routeDtmfInput({ stateKey: "main_menu", digits: "8" });
  assert.equal(repeat.action, "prompt.main");

  const main = routeDtmfInput({ stateKey: "main_menu", digits: "0" });
  assert.equal(main.eventType, "dtmf.main");

  const staff = routeDtmfInput({ stateKey: "main_menu", digits: "9" });
  assert.equal(staff.action, "transfer.staff");
  assert.equal(staff.sessionState, "transferred");
});

test("Build 011 back convention returns entry flows to main menu", () => {
  for (const [stateKey, inputKind] of [
    ["site_entry", "site"],
    ["reservation_entry", "reservation"],
    ["pass_entry", "pass"],
  ]) {
    const result = routeDtmfInput({
      stateKey,
      inputKind,
      digits: "*",
    });

    assert.equal(result.toState, "main_menu");
    assert.equal(result.eventType, "dtmf.back");
  }
});

test("Build 011 collects site, reservation and pass numeric entries transiently", () => {
  const cases = [
    ["site_entry", "site", "042#", "lookup.site", "042"],
    [
      "reservation_entry",
      "reservation",
      "7654321#",
      "lookup.reservation",
      "7654321",
    ],
    ["pass_entry", "pass", "90017#", "lookup.pass", "90017"],
  ];

  for (const [stateKey, inputKind, digits, action, value] of cases) {
    const result = routeDtmfInput({
      stateKey,
      inputKind,
      digits,
    });

    assert.equal(result.action, action);
    assert.equal(result.transientEntry?.value, value);
    assert.equal(result.toState, "main_menu");
    assert.equal(result.retryCount, 0);
  }
});

test("Build 011 DTMF timeout and invalid input retries are bounded", () => {
  const first = routeDtmfInput({
    stateKey: "reservation_entry",
    inputKind: "reservation",
    timedOut: true,
    retryCount: 0,
    maxRetries: 3,
  });

  assert.equal(first.retryCount, 1);
  assert.equal(first.action, "prompt.reservation");

  const final = routeDtmfInput({
    stateKey: "reservation_entry",
    inputKind: "reservation",
    timedOut: true,
    retryCount: 2,
    maxRetries: 3,
  });

  assert.equal(final.retryCount, 3);
  assert.equal(final.action, "transfer.staff");
  assert.equal(final.sessionState, "transferred");
});

test("Build 011 masks PIN and verification input without retaining raw digits", () => {
  const pin = summarizeDtmfInput({
    inputKind: "pin",
    digits: "2468#",
  });
  const verification = summarizeDtmfInput({
    inputKind: "verification",
    digits: "902114",
  });

  assert.deepEqual(pin, {
    inputKind: "pin",
    digitCount: 4,
    sensitive: true,
    maskedValue: "[redacted:4]",
  });
  assert.equal(verification.maskedValue, "[redacted:6]");
  assert.doesNotMatch(JSON.stringify(pin), /2468/u);
  assert.doesNotMatch(JSON.stringify(verification), /902114/u);
  assert.equal(maskDtmfDigits("123456#"), "[redacted:6]");
});

test("Build 011 provider input validation rejects unsupported keypad payloads", () => {
  assert.throws(
    () =>
      normalizeDtmfProviderInput({
        eventType: "dtmf.input",
        inputKind: "menu",
        digits: "1A",
      }),
    /unsupported keypad characters/,
  );

  assert.throws(
    () =>
      normalizeDtmfProviderInput({
        eventType: "dtmf.input",
        inputKind: "pin",
        digits: "*",
      }),
    /numeric digits only/,
  );
});
