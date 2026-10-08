import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWorkflowParityRegistry,
  createIvrWorkflowAdapter,
  createSmsWorkflowAdapter,
  getWorkflowDefinition,
  getWorkflowParityHealth,
  workflowParityMatrix,
} from "../lib/parity/core.mjs";

test("every registered workflow declares explicit Web, IVR and SMS support", () => {
  assert.equal(assertWorkflowParityRegistry(), true);
  assert.ok(workflowParityMatrix.length >= 20);

  for (const workflow of workflowParityMatrix) {
    assert.ok(workflow.support.web);
    assert.ok(workflow.support.ivr);
    assert.ok(workflow.support.sms);
  }

  const health = getWorkflowParityHealth();
  assert.equal(health.workflows, workflowParityMatrix.length);
  assert.equal(health.safeguards.canonicalDomainCommandsOnly, true);
  assert.equal(health.safeguards.visualStepsUseHandoff, true);
});

test("guest reservation workflow uses the same canonical domain command through IVR and SMS", async () => {
  const calls = [];
  const executeCanonicalCommand = async (request) => {
    calls.push(request);
    return { accepted: true };
  };
  const dependencies = {
    executeCanonicalCommand,
    createSecureLink: async () => {
      throw new Error("unexpected_secure_link");
    },
    requestStaffTransfer: async () => {
      throw new Error("unexpected_staff_transfer");
    },
  };

  const ivr = createIvrWorkflowAdapter(dependencies);
  const sms = createSmsWorkflowAdapter(dependencies);

  await ivr.invoke({
    workflowId: "reservation.search",
    campgroundId: "camp-1",
    input: { arrival: "2027-06-01", nights: 3 },
  });
  await sms.invoke({
    workflowId: "reservation.search",
    campgroundId: "camp-1",
    input: { arrival: "2027-06-01", nights: 3 },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "reservation.search");
  assert.equal(calls[1].command, "reservation.search");
  assert.deepEqual(calls[0].input, calls[1].input);
  assert.equal(calls[0].channel, "ivr");
  assert.equal(calls[1].channel, "sms");
});

test("staff work-order status workflow preserves the same command and verification requirement", async () => {
  const calls = [];
  const executeCanonicalCommand = async (request) => {
    calls.push(request);
    return { status: "accepted" };
  };

  const ivr = createIvrWorkflowAdapter({ executeCanonicalCommand });
  const sms = createSmsWorkflowAdapter({ executeCanonicalCommand });

  await ivr.invoke({
    workflowId: "work-order.status.update",
    actor: { kind: "staff" },
    input: { workOrderId: "wo-7", status: "in_progress" },
  });
  await sms.invoke({
    workflowId: "work-order.status.update",
    actor: { kind: "staff" },
    input: { workOrderId: "wo-7", status: "in_progress" },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, "work-order.status.update");
  assert.equal(calls[1].command, "work-order.status.update");
  assert.equal(calls[0].requiresVerification, true);
  assert.equal(calls[1].requiresVerification, true);
});

test("graphical polygon editing uses staff fallback for IVR and secure-link handoff for SMS", async () => {
  let canonicalCalls = 0;
  const transfers = [];
  const links = [];
  const dependencies = {
    executeCanonicalCommand: async () => {
      canonicalCalls += 1;
      return {};
    },
    createSecureLink: async (request) => {
      links.push(request);
      return { tokenReference: "synthetic-link-ref" };
    },
    requestStaffTransfer: async (request) => {
      transfers.push(request);
      return { queue: "management" };
    },
  };

  const ivr = createIvrWorkflowAdapter(dependencies);
  const sms = createSmsWorkflowAdapter(dependencies);

  const ivrResult = await ivr.invoke({
    workflowId: "map.polygon.edit",
    campgroundId: "camp-1",
  });
  const smsResult = await sms.invoke({
    workflowId: "map.polygon.edit",
    campgroundId: "camp-1",
  });

  assert.equal(canonicalCalls, 0);
  assert.equal(ivrResult.kind, "staff-transfer");
  assert.equal(smsResult.kind, "secure-link");
  assert.equal(transfers.length, 1);
  assert.equal(links.length, 1);
  assert.equal(links[0].purpose, "graphical-map-edit");
  assert.equal(getWorkflowDefinition("map.polygon.edit").visualOnly, true);
});

test("canonical commands can request a secure visual handoff without moving business rules into the adapter", async () => {
  const links = [];
  const sms = createSmsWorkflowAdapter({
    executeCanonicalCommand: async (request) => {
      assert.equal(request.command, "accommodation.info");
      return {
        requiresVisualStep: true,
        visualReason: "gallery_requested",
      };
    },
    createSecureLink: async (request) => {
      links.push(request);
      return { tokenReference: "synthetic-gallery-link" };
    },
  });

  const result = await sms.invoke({
    workflowId: "accommodation.info",
    campgroundId: "camp-1",
    input: { accommodationNumber: 42 },
  });

  assert.equal(result.kind, "secure-link");
  assert.equal(result.reason, "gallery_requested");
  assert.equal(links.length, 1);
});

test("high-risk payment workflow never sends card collection through the canonical SMS or IVR adapter", async () => {
  let canonicalCalls = 0;
  const dependencies = {
    executeCanonicalCommand: async () => {
      canonicalCalls += 1;
      return {};
    },
    createSecureLink: async () => ({ tokenReference: "payment-link" }),
    requestStaffTransfer: async () => ({ queue: "front-desk" }),
  };

  const ivrResult = await createIvrWorkflowAdapter(dependencies).invoke({
    workflowId: "payment.complete",
  });
  const smsResult = await createSmsWorkflowAdapter(dependencies).invoke({
    workflowId: "payment.complete",
  });

  assert.equal(canonicalCalls, 0);
  assert.equal(ivrResult.kind, "staff-transfer");
  assert.equal(smsResult.kind, "secure-link");
});
