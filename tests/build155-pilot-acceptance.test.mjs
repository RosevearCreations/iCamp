import assert from "node:assert/strict";
import test from "node:test";

import {
  PILOT_AREAS,
  blankPilot,
  summarizePilot,
} from "../lib/pilot/build155-acceptance.mjs";

test("pilot defaults to six untested operational areas and no launch authority", () => {
  const report = summarizePilot(blankPilot());
  assert.equal(PILOT_AREAS.length, 6);
  assert.equal(report.counts.NOT_TESTED, 6);
  assert.equal(report.public_launch_authorized, false);
  assert.equal(report.production_activation_authorized, false);
});

test("untrusted fields and invalid states cannot become proof", () => {
  const report = summarizePilot({
    booking: "PASSED_OWNER_REPORTED",
    access: "APPROVED_FOR_PRODUCTION",
    secret: "never export",
  });
  assert.equal(report.results.booking, "PASSED_OWNER_REPORTED");
  assert.equal(report.results.access, "NOT_TESTED");
  assert.equal(report.pilot_acceptance, "NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(JSON.stringify(report).includes("secret"), false);
});
