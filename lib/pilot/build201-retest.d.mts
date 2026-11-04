export interface Build201RetestFinding {
  journey: string;
  device: string;
  state: string;
  ticket_ref: string;
  evidence_ref: string | null;
  independently_witnessed?: false;
}
export const BUILD201_RETEST_SCHEMA: string;
export const BUILD201_MAX_FINDINGS: number;
export const BUILD201_DEVICE_PROFILES: readonly string[];
export const BUILD201_FINDING_STATES: readonly string[];
export function normalizeBuild201Finding(
  raw: unknown,
  allowedJourneyIds: Set<string>,
): Build201RetestFinding;
export function normalizeBuild201Findings(
  raw: unknown,
  journeys: readonly { id: string }[],
): Build201RetestFinding[];
export function importBuild201Retest(
  text: string,
  journeys: readonly { id: string }[],
): Build201RetestFinding[];
export function build201RetestPacket(
  raw: unknown,
  journeys: readonly { id: string }[],
): Promise<{
  schema: string;
  fixture: string;
  build: number;
  source_sha256: string;
  rows: Build201RetestFinding[];
  counts: Record<string, number>;
  evidence_class: "UNATTESTED_OWNER_LOCAL_RETEST";
  real_device_witness: "UNVERIFIED";
  independent_signoff: "MISSING";
  signed_comms_hub_peer: "MISSING";
  go_live_decision: "NO_GO_PENDING_EVIDENCE";
  external_effects: false;
}>;
