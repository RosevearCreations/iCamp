export interface RentalSession263 {
  id: string;
  offerId: string;
  plannedDay: string;
  startMinute: number;
  endMinute: number;
  participantLimit: number;
  activityKind: string;
  safetyBrief: string;
  status: string;
  assetName: string;
}
export function listSupervisedSessions263(input: {
  actorUserId: string;
  campgroundId: string;
}): Promise<{
  status: string;
  sessions: RentalSession263[];
  note?: string;
  evidenceMayBeTruncated?: boolean;
}>;
export function planSupervisedSession263(input: {
  actorUserId: string;
  actorSessionId: string | null;
  campgroundId: string;
  input: Record<string, unknown>;
}): Promise<string>;
export function cancelSupervisedSession263(input: {
  actorUserId: string;
  actorSessionId: string | null;
  campgroundId: string;
  sessionId: string;
}): Promise<string>;
export function closeRentalSessions263PoolForTests(): Promise<void>;
