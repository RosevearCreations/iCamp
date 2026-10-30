import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIT_SECTIONS,
  blankAudit,
  makeAuditReport,
} from "../lib/launch/build158-audit.mjs";

test("Build 158 begins unverified with all operations held", () => {
  const report = makeAuditReport(blankAudit());
  assert.equal(report.required_total, 11);
  assert.equal(AUDIT_SECTIONS.length, 11);
  assert.equal(report.reported_done, 0);
  assert.equal(report.live_tenant_billing_enabled, false);
  assert.equal(report.authenticated_get_authorized, false);
  assert.equal(report.integration_gate, "HOLD");
  assert.equal(report.commercial_launch_authorized, false);
});

test("owner-reported completions cannot independently verify anything", () => {
  const input = Object.fromEntries(
    AUDIT_SECTIONS.map(([id]) => [id, "OWNER_REPORTS_DONE_UNVERIFIED"]),
  );
  const report = makeAuditReport(input);
  assert.equal(report.reported_done, 11);
  assert.equal(report.provider_adapter_verified, false);
  assert.equal(report.subscriber_terms_approved, false);
  assert.equal(report.independent_custody_verified, false);
});

test("unexpected fields and invalid states cannot enter exported packet", () => {
  const report = makeAuditReport({
    billing_adapter: "APPROVED",
    billing_lifecycle: "BLOCKED",
    secret: "not-for-export",
    person_name: "private",
  });
  assert.equal(report.checks.billing_adapter, "NOT_SUBMITTED");
  assert.equal(report.checks.billing_lifecycle, "BLOCKED");
  assert.equal(JSON.stringify(report).includes("not-for-export"), false);
  assert.equal(JSON.stringify(report).includes("person_name"), false);
});
