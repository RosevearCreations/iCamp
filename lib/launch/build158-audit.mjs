export const AUDIT_SECTIONS = Object.freeze([
  ["billing_adapter", "Reviewed campground subscription adapter"],
  [
    "billing_credentials",
    "Scoped provider configuration in protected environment",
  ],
  ["billing_webhooks", "Signed webhooks and idempotency tests"],
  ["billing_lifecycle", "Cancellation, refunds, suspension and invoice tests"],
  ["terms_versions", "Reviewed subscriber agreement and privacy versions"],
  ["terms_consent", "Explicit versioned acceptance receipt tested"],
  [
    "terms_disclosures",
    "Canadian renewal, tax and cancellation disclosure review",
  ],
  ["isolated_tenant", "Isolated nonproduction tenant independently verified"],
  ["custody_witness", "Separate signer, witness and reviewer authenticated"],
  [
    "original_proof",
    "Original signed proof B and public pin independently checked",
  ],
  ["test_authorization", "Explicit owner TEST-only signed GET authorization"],
]);

export const AUDIT_STATES = Object.freeze([
  "NOT_SUBMITTED",
  "BLOCKED",
  "OWNER_REPORTS_DONE_UNVERIFIED",
]);

export function blankAudit() {
  return Object.fromEntries(
    AUDIT_SECTIONS.map(([id]) => [id, AUDIT_STATES[0]]),
  );
}

export function makeAuditReport(input) {
  const checks = Object.fromEntries(
    AUDIT_SECTIONS.map(([id]) => [
      id,
      AUDIT_STATES.includes(input?.[id]) ? input[id] : AUDIT_STATES[0],
    ]),
  );
  return {
    schema: "icamp.build158.nonsecret-owner-audit.v1",
    build: 158,
    checks,
    reported_done: Object.values(checks).filter(
      (value) => value === "OWNER_REPORTS_DONE_UNVERIFIED",
    ).length,
    required_total: AUDIT_SECTIONS.length,
    provider_adapter_verified: false,
    subscriber_terms_approved: false,
    independent_custody_verified: false,
    authenticated_get_authorized: false,
    live_tenant_billing_enabled: false,
    integration_connection: "DISCONNECTED",
    integration_gate: "HOLD",
    commercial_launch_authorized: false,
  };
}
