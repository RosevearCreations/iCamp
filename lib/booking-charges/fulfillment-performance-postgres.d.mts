import type { FieldClosureEvent } from "./fulfillment-performance-core.mjs";
export function listFieldClosureEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{ events: FieldClosureEvent[]; truncated: boolean }>;
export function recordFieldClosureEvidence(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  fieldReportId: string;
  reviewId: string;
  previousEventId?: string | null;
  decision: string;
  evidenceReference: string;
  note: string;
}): Promise<{ id: string }>;
