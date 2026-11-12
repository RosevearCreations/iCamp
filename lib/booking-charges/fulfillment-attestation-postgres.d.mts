import type {
  OriginalDeviceReview,
  CalibrationFollowup,
} from "./fulfillment-attestation-core.mjs";
import type { ForecastCheckpoint } from "./fulfillment-witness-core.mjs";
export function listAttestationCalibrationEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  originalDeviceReviews: OriginalDeviceReview[];
  calibrations: CalibrationFollowup[];
  truncated: boolean;
}>;
export function recordOriginalDeviceReview(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  fieldReportId: string;
  witnessId: string;
  previousReviewId?: string | null;
  evidenceReference: string;
  digestSha256: string;
  decision: string;
  explanation: string;
}): Promise<{ id: string }>;
export function recordCalibrationFollowup(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  checkpointId: string;
  previousEventId?: string | null;
  decision: string;
  explanation: string;
  checkpoints: ForecastCheckpoint[];
  reviews: Array<{ id: string; decision: string; reviewedAt: string }>;
  handoffs: Array<{ id: string; eventKind: string; recordedAt: string }>;
  truncated: boolean;
  asOf: string;
}): Promise<{ id: string }>;
