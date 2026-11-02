import assert from "node:assert/strict";

import {
  assertWorkflowParityRegistry,
  createIvrWorkflowAdapter,
  createSmsWorkflowAdapter,
  getWorkflowParityHealth,
} from "../lib/parity/core.mjs";

assert.equal(assertWorkflowParityRegistry(), true);

const canonicalCalls = [];
const secureLinks = [];
const transfers = [];

const dependencies = {
  executeCanonicalCommand: async (request) => {
    canonicalCalls.push(request);
    return { accepted: true };
  },
  createSecureLink: async (request) => {
    secureLinks.push(request);
    return { tokenReference: "synthetic-secure-link" };
  },
  requestStaffTransfer: async (request) => {
    transfers.push(request);
    return { queue: "synthetic-staff-queue" };
  },
};

const ivr = createIvrWorkflowAdapter(dependencies);
const sms = createSmsWorkflowAdapter(dependencies);

for (const workflowId of [
  "reservation.search",
  "work-order.status.update",
  "asset.status.query",
]) {
  await ivr.invoke({
    workflowId,
    campgroundId: "synthetic-campground",
    input: { synthetic: true },
  });
  await sms.invoke({
    workflowId,
    campgroundId: "synthetic-campground",
    input: { synthetic: true },
  });
}

for (const workflowId of [
  "reservation.search",
  "work-order.status.update",
  "asset.status.query",
]) {
  const calls = canonicalCalls.filter((call) => call.workflowId === workflowId);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, calls[1].command);
  assert.deepEqual(
    new Set(calls.map((call) => call.channel)),
    new Set(["ivr", "sms"]),
  );
}

const polygonIvr = await ivr.invoke({
  workflowId: "map.polygon.edit",
  campgroundId: "synthetic-campground",
});
const polygonSms = await sms.invoke({
  workflowId: "map.polygon.edit",
  campgroundId: "synthetic-campground",
});

assert.equal(polygonIvr.kind, "staff-transfer");
assert.equal(polygonSms.kind, "secure-link");
assert.equal(transfers.length >= 1, true);
assert.equal(secureLinks.length >= 1, true);

const health = getWorkflowParityHealth();
assert.equal(health.status, "ready");
assert.equal(health.workflows >= 20, true);
assert.equal(health.graphicalOnly >= 1, true);
assert.equal(health.safeguards.canonicalDomainCommandsOnly, true);
assert.equal(health.safeguards.visualStepsUseHandoff, true);
assert.equal(health.safeguards.staffFallbackAvailable, true);
assert.equal(health.safeguards.callerOrSenderHintIsAuthentication, false);

process.stdout.write(
  "Build 015 telephone/SMS workflow parity verification passed.\n",
);
