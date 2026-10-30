import assert from "node:assert/strict";
import test from "node:test";
import {
  LAUNCH_CHECKS,
  blankLaunch,
  launchReport,
} from "../lib/launch/build156-gate.mjs";

test("seven launch gates begin unverified and integration remains held", () => {
  const report = launchReport(blankLaunch());
  assert.equal(LAUNCH_CHECKS.length, 7);
  assert.ok(Object.values(report.checks).every((v) => v === "NOT_VERIFIED"));
  assert.equal(report.public_launch_authorized, false);
  assert.equal(report.billing_live, false);
  assert.equal(report.integration_gate, "HOLD");
});

test("reported readiness cannot enable services or leak arbitrary input", () => {
  const report = launchReport({
    legal: "OWNER_REPORTED_READY",
    token: "private",
  });
  assert.equal(report.checks.legal, "OWNER_REPORTED_READY");
  assert.equal(report.checks.pilot, "NOT_VERIFIED");
  assert.equal(report.external_services_enabled, false);
  assert.equal(JSON.stringify(report).includes("private"), false);
});
