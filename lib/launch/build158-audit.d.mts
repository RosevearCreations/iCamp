export type AuditState =
  "NOT_SUBMITTED" | "BLOCKED" | "OWNER_REPORTS_DONE_UNVERIFIED";
export const AUDIT_SECTIONS: readonly (readonly [string, string])[];
export const AUDIT_STATES: readonly AuditState[];
export function blankAudit(): Record<string, AuditState>;
export function makeAuditReport(input: Record<string, unknown>): {
  schema: string;
  build: number;
  checks: Record<string, AuditState>;
  reported_done: number;
  required_total: number;
  provider_adapter_verified: false;
  subscriber_terms_approved: false;
  independent_custody_verified: false;
  authenticated_get_authorized: false;
  live_tenant_billing_enabled: false;
  integration_connection: "DISCONNECTED";
  integration_gate: "HOLD";
  commercial_launch_authorized: false;
};
