export declare const ql255Stages: Readonly<
  Record<string, ReadonlyArray<string>>
>;
export interface Ql255HoldReview {
  id: string;
  ql254ReviewId: string;
  priorReviewId: string | null;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceSystem: string;
  repository: string;
  reviewKind: string;
  outcomeKind: string;
  observedMainSha: string | null;
  sourceShaA: string | null;
  sourceCiRunUrl: string | null;
  proofCommitShaB: string | null;
  proofSha256: string | null;
  proofHttpStatus: string;
  publicAuditReference: string | null;
  registrySnapshotSha256: string | null;
  signerPinSha256: string | null;
  witnessPinSha256: string | null;
  custodianReceiptId: string | null;
  witnessReceiptId: string | null;
  registryReceiptId: string | null;
  nonceChallengeSha256: string | null;
  nonceIssuedAt: string | null;
  nonceExpiresAt: string | null;
  relayPlanKind: string;
  relayPlanReference: string | null;
  healthIntervalSeconds: number | null;
  testTenantId: string | null;
  testWindowStart: string | null;
  testWindowEnd: string | null;
  nextDueAt: string;
  evidenceReference: string;
  reviewNote: string;
}
export declare function normalizeQl255HoldReview(
  raw: Record<string, unknown>,
  now?: Date,
): Ql255HoldReview;
export declare function classifyQl255ReviewStatus(
  record: { review_kind: string; next_due_at: string },
  next: unknown,
  now?: Date,
): string;
export declare function simulateQl255RelayRollback(events?: string[]): {
  simulation_phase: string;
  real_relay_running: false;
  home_endpoint_exposed: false;
  owner_test_authorized: false;
  actual_gateway_gets: "NOT_RUN";
  connection_state: "DISCONNECTED";
  gate_state: "HOLD";
};
