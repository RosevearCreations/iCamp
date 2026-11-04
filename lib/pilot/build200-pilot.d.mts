export interface Build200Journey {
  id: string;
  title: string;
  href: string;
  routes: readonly string[];
  tests: readonly string[];
  manual: string;
}
export const BUILD200_JOURNEYS: readonly Build200Journey[];
export const BUILD200_REVIEW_STATES: readonly string[];
export function build200ReviewRows(
  reports?: Record<string, { state?: string; sourceRef?: string }>,
): {
  rows: Array<{
    journey: string;
    state: string;
    source_ref: string | null;
    awaiting_independent_review: boolean;
    automated_source_present_is_not_owner_acceptance: true;
  }>;
  counts: Record<string, number>;
};
export function build200ReviewPacket(
  reports?: Record<string, { state?: string; sourceRef?: string }>,
): Promise<{
  schema: string;
  build: number;
  fixture: string;
  source_sha256: string;
  rows: Array<{
    journey: string;
    state: string;
    source_ref: string | null;
    awaiting_independent_review: boolean;
    automated_source_present_is_not_owner_acceptance: true;
  }>;
  counts: Record<string, number>;
  signed_original_comms_hub_source: "MISSING";
  independent_pilot_signoff: "MISSING";
  real_device_acceptance: "MISSING";
  public_launch_authorized: false;
  omnichannel_connection: "DISCONNECTED / HOLD";
  owner_go_live_decision: "NO_GO_PENDING_EVIDENCE";
  external_effects: false;
}>;
