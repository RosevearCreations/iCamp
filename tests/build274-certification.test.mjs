import test from "node:test";
import assert from "node:assert/strict";
import { classify274 } from "../lib/build274/certification.mjs";
const none = {
  hostPinned: false,
  adopted: false,
  bookingSignerConfigured: false,
  commsSignerConfigured: false,
  restoreSignerConfigured: false,
  consumerAck: 0,
  incidentClosed: 0,
  providerRestore: 0,
  status: "HOLD",
};
test("missing original evidence remains HOLD", () => {
  const r = classify274(none, null);
  assert.equal(r.status, "PENDING_INDEPENDENT_LIVE_ACCEPTANCE");
  assert.equal(r.checks.filter((x) => x.status === "HOLD").length, 7);
});
test("source counters do not claim seven-source live certification", () => {
  const r = classify274(
    {
      ...none,
      hostPinned: true,
      adopted: true,
      bookingSignerConfigured: true,
      commsSignerConfigured: true,
      restoreSignerConfigured: true,
      consumerAck: 15,
      incidentClosed: 3,
      providerRestore: 2,
    },
    { originalRosevear: true, aal2: true },
  );
  assert.equal(r.checks.find((x) => x.id === "seven-source").status, "HOLD");
  assert.ok(r.checks.every((x) => x.status !== "CERTIFIED"));
});
test("MFA and Rosevear identity must both be original evidence", () => {
  const r = classify274(none, { originalRosevear: true, aal2: false });
  assert.equal(r.checks.find((x) => x.id === "owner-session").status, "HOLD");
});
