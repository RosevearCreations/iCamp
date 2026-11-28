import assert from "node:assert/strict";
import test from "node:test";

import {
  onboardingReadiness289,
  prepareTenantPlan289,
} from "../lib/build289/onboarding.mjs";

test("Build 289 onboarding never treats missing sources as complete", () => {
  const steps = onboardingReadiness289({
    structure: { sections: [] },
    accommodations: null,
    maps: [{ isPublished: true, readiness: { ready: false } }],
  });
  assert.deepEqual(
    steps.map((step) => step.state),
    ["RECORDED", "NEEDS_SETUP", "UNKNOWN", "NEEDS_SETUP"],
  );
});

test("Build 289 reviewed draft cannot imply tenant or payment activation", () => {
  const input = {
    name: "Synthetic campground",
    region: "Ontario",
    timezone: "America/Toronto",
    season: "seasonal",
    siteCount: 12,
  };
  const plan = prepareTenantPlan289(input);
  assert.equal(plan.tenantCreated, false);
  assert.equal(plan.ownerAssignmentCreated, false);
  assert.equal(plan.billingEnabled, false);
  assert.throws(() => prepareTenantPlan289({ ...input, timezone: "invalid" }));
  assert.throws(() => prepareTenantPlan289({ ...input, siteCount: -1 }));
});
