import type { ShiftEvent } from "./fulfillment-shift-core.mjs";
export function listShiftRecoveryEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  colleagues: Array<{ userId: string; email: string }>;
  handoffs: ShiftEvent[];
  reviews: Array<{
    id: string;
    dispatchId: string;
    reviewKind: string;
    decision: string;
    reviewedAt: string;
  }>;
  truncated: boolean;
}>;
export function requestShiftHandoff(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  ownerEventId: string;
  targetUserId: string;
  note: string;
}): Promise<{ id: string }>;
export function decideShiftHandoff(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  requestId: string;
  decision: string;
  note: string;
}): Promise<{ id: string; newOwnershipId: string | null }>;
