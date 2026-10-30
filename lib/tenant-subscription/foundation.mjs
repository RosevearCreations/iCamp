import { createHash } from "node:crypto";

export const BILLING_PROVIDER_OPTIONS = Object.freeze([
  "unconfigured",
  "stripe",
]);
export const BILLING_EVENTS = Object.freeze([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
]);

const REQUIRED_EVIDENCE = Object.freeze([
  "provider_sandbox",
  "signed_webhook",
  "subscription_lifecycle",
  "reviewed_terms",
  "versioned_consent",
  "isolated_tenant",
  "independent_custody",
  "signed_source_proof",
  "owner_test_authorization",
]);

const EVIDENCE_STATES = Object.freeze([
  "MISSING",
  "OWNER_REPORTED",
  "INDEPENDENTLY_REVIEWED",
  "REJECTED",
]);

export function subscriptionAdapterFoundation(provider = "unconfigured") {
  if (!BILLING_PROVIDER_OPTIONS.includes(provider)) {
    throw new Error("Unsupported subscription provider identifier.");
  }
  return Object.freeze({
    schema: "icamp.tenant-subscription-adapter.v1",
    provider,
    mode: "DISABLED",
    checkout_enabled: false,
    portal_enabled: false,
    webhook_ingestion_enabled: false,
    required_events: [...BILLING_EVENTS],
    adapter_operations: Object.freeze({
      create_checkout: "NOT_IMPLEMENTED",
      open_customer_portal: "NOT_IMPLEMENTED",
      verify_webhook: "NOT_IMPLEMENTED",
      reconcile_subscription: "NOT_IMPLEMENTED",
    }),
  });
}

function canonicalVersion(version) {
  if (
    typeof version !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(version)
  ) {
    throw new Error(
      "Consent document versions must be explicit, bounded identifiers.",
    );
  }
  return version;
}

/**
 * Produces an unsigned, nonbinding draft, not a legally accepted or stored receipt.
 * A future authorized server workflow must verify approved documents, authentication,
 * timestamp and append-only storage before creating a genuine subscriber receipt.
 */
export function previewSubscriberConsentReceipt({
  termsVersion,
  privacyVersion,
  consentGranted,
} = {}) {
  const terms = canonicalVersion(termsVersion);
  const privacy = canonicalVersion(privacyVersion);
  if (consentGranted !== true) {
    throw new Error("Consent must be an explicit affirmative action.");
  }
  const content = `icamp.consent-preview.v1\n${terms}\n${privacy}\nEXPLICIT_YES`;
  return Object.freeze({
    schema: "icamp.subscriber-consent-preview.v1",
    terms_version: terms,
    privacy_version: privacy,
    document_version_digest: createHash("sha256").update(content).digest("hex"),
    acceptance_recorded: false,
    legally_binding: false,
    persisted: false,
    pending: [
      "approved_document_registry",
      "authenticated_subscriber",
      "append_only_receipt_storage",
    ],
  });
}

export function blankIndependentEvidence() {
  return Object.fromEntries(REQUIRED_EVIDENCE.map((key) => [key, "MISSING"]));
}

export function reconcileIndependentEvidence(input) {
  const checks = Object.fromEntries(
    REQUIRED_EVIDENCE.map((key) => {
      const value = input?.[key];
      return [key, EVIDENCE_STATES.includes(value) ? value : "MISSING"];
    }),
  );
  const reviewed = Object.values(checks).filter(
    (value) => value === "INDEPENDENTLY_REVIEWED",
  ).length;
  const rejected = Object.values(checks).filter(
    (value) => value === "REJECTED",
  ).length;
  return Object.freeze({
    schema: "icamp.build159.independent-evidence.v1",
    build: 159,
    checks,
    reviewed,
    required: REQUIRED_EVIDENCE.length,
    rejected,
    owner_reports_cannot_authorize: true,
    independent_validation_performed: false,
    billing_provider_live: false,
    subscriber_contract_live: false,
    tenant_subscription_charges_enabled: false,
    external_messages_enabled: false,
    integration_connection: "DISCONNECTED",
    integration_gate: "HOLD",
    authenticated_gateway_gets_authorized: false,
  });
}

export const INDEPENDENT_EVIDENCE_ITEMS = REQUIRED_EVIDENCE;
export const INDEPENDENT_EVIDENCE_STATES = EVIDENCE_STATES;
