export const BILLING_PROVIDER_OPTIONS: readonly ["unconfigured", "stripe"];
export const BILLING_EVENTS: readonly string[];
export const INDEPENDENT_EVIDENCE_ITEMS: readonly string[];
export const INDEPENDENT_EVIDENCE_STATES: readonly string[];
export type EvidenceState =
  "MISSING" | "OWNER_REPORTED" | "INDEPENDENTLY_REVIEWED" | "REJECTED";
export type EvidenceChecks = Record<string, EvidenceState>;
export function subscriptionAdapterFoundation(
  provider?: "unconfigured" | "stripe",
): {
  readonly schema: string;
  readonly provider: string;
  readonly mode: "DISABLED";
  readonly checkout_enabled: false;
  readonly portal_enabled: false;
  readonly webhook_ingestion_enabled: false;
  readonly required_events: readonly string[];
  readonly adapter_operations: Readonly<Record<string, string>>;
};
export function previewSubscriberConsentReceipt(input: {
  termsVersion: string;
  privacyVersion: string;
  consentGranted: boolean;
}): {
  readonly schema: string;
  readonly terms_version: string;
  readonly privacy_version: string;
  readonly document_version_digest: string;
  readonly acceptance_recorded: false;
  readonly legally_binding: false;
  readonly persisted: false;
  readonly pending: readonly string[];
};
export function blankIndependentEvidence(): EvidenceChecks;
export function reconcileIndependentEvidence(input?: Record<string, string>): {
  readonly schema: string;
  readonly build: 159;
  readonly checks: EvidenceChecks;
  readonly reviewed: number;
  readonly required: number;
  readonly rejected: number;
  readonly owner_reports_cannot_authorize: true;
  readonly independent_validation_performed: false;
  readonly billing_provider_live: false;
  readonly subscriber_contract_live: false;
  readonly tenant_subscription_charges_enabled: false;
  readonly external_messages_enabled: false;
  readonly integration_connection: "DISCONNECTED";
  readonly integration_gate: "HOLD";
  readonly authenticated_gateway_gets_authorized: false;
};
