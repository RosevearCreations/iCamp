export interface SandboxEventSummary {
  id: string;
  type: string;
  verified: boolean;
}

export interface Build199ScenarioReport {
  schema: "icamp.build199.sandbox-fixture-report.v1";
  build: 199;
  scenario: string;
  label: string;
  event_source: "LOCAL_SYNTHETIC_FIXTURE_ONLY";
  source_sha256: string;
  tenant_key: string;
  lifecycle: {
    subscription_state: string;
    payment_state: string;
    risk_state: string;
    external_writes: false;
    charges_enabled: false;
  };
  signed_events_verified: number;
  duplicate_deliveries_ignored: number;
  events: SandboxEventSummary[];
  provider_official_test_receipts: "MISSING";
  legal_documents_approved: false;
  real_charges_possible: false;
  outbound_calls: false;
  persisted: false;
  activation: "HELD";
}

export const BUILD199_SCENARIOS: Readonly<
  Record<string, Readonly<{ label: string; events: readonly string[][] }>>
>;
export function runBuild199Scenario(scenario?: string): Build199ScenarioReport;
export function signSyntheticWebhook(input: {
  payload: string;
  timestamp: number;
  secret: Buffer;
}): string;
export function verifySyntheticWebhook(input: {
  payload: string;
  header: string;
  secret: Buffer;
  now: number;
}): Readonly<Record<string, unknown>>;
export function previewSandboxLegalGate(input: {
  termsVersion: string;
  privacyVersion: string;
  explicitlyAccepted: boolean;
  signedInActor: string;
  submittingActor: string;
  independentReviewer: string;
}): Readonly<Record<string, unknown>>;
