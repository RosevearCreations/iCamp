export const BUILD202_EVIDENCE_CLASSES: readonly string[];
export const BUILD202_DEVICES: readonly string[];
export const BUILD202_STATUS: "SUBMITTED_UNVERIFIED";
export interface Build202Evidence {
  campgroundId: string;
  sourceClass: string;
  evidenceRef: string;
  claimedSha256: string;
  deviceProfile: string | null;
  disposition: "SUBMITTED_UNVERIFIED";
  independentVerification: false;
}
export function validateBuild202Evidence(input: unknown): Build202Evidence;
export function build202EvidenceReadback(
  rows?: Array<Record<string, unknown>>,
): {
  schema: string;
  rows: Array<{
    id: unknown;
    sourceClass: unknown;
    evidenceRef: unknown;
    claimedSha256: unknown;
    deviceProfile: unknown;
    submittedAt: string;
    disposition: string;
    independentVerification: false;
  }>;
  peer_enrollment: string;
  source_signer: string;
  scope_test_approval: string;
  signed_get_witness: string;
  connection_state: string;
  owner_go_live_decision: string;
  no_activation_or_external_dispatch: true;
};
