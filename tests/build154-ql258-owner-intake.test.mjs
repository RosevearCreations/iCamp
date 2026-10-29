import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { CHECKPOINTS } from "../lib/integration/ql258-checkpoints.mjs";
import {
  STATUS,
  defaults,
  makeReport,
} from "../lib/integration/ql258-contract.mjs";

test("QL-258 has exactly seven fixed progress checkpoints", () => {
  assert.equal(CHECKPOINTS.length, 7);
  assert.equal(STATUS.length, 3);
  assert.equal(Object.keys(defaults()).length, 7);
});

test("Reported completion never authorizes external integration", () => {
  const progress = defaults();
  progress.custodian = "OWNER_REPORTS_DONE_NOT_VERIFIED";
  const result = makeReport(progress);
  assert.equal(result.connection, "DISCONNECTED");
  assert.equal(result.gate, "HOLD");
  assert.equal(result.owner_test_authorization, "NOT_GIVEN");
  assert.equal(result.pilot_holds, 12);
  assert.equal(result.verified, false);
});

test("Unknown progress, fields, and missing states are rejected", () => {
  assert.throws(() => makeReport({ ...defaults(), extra: "unexpected" }));
  assert.throws(() => makeReport({ ...defaults(), proof: "VERIFIED" }));
  assert.throws(() => makeReport({}));
  assert.throws(() => makeReport(null));
});

test("The worksheet copies a local export without sending requests", () => {
  const path = new URL(
    "../app/integration/ql258/worksheet.tsx",
    import.meta.url,
  );
  const ui = readFileSync(path, "utf8");
  assert.match(ui, /navigator.clipboard.writeText\(packet\)/u);
  assert.doesNotMatch(ui, /fetch\(|localStorage|sessionStorage/u);
});
