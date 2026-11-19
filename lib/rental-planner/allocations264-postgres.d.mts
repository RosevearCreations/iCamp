export interface StaffAllocation264 {
  id: string; requestId: string; offerId: string; guestUserId: string;
  startDate: string; endDate: string; status: string; requestStatus: string;
  assetName: string; approvedAt: string;
}
export interface GuestAllocation264 {
  id: string; requestId: string; assetName: string; campgroundName: string;
  startDate: string; endDate: string; status: string;
}
export interface PilotReview264 {
  id: string; sessionId: string; outcome: string; originalEvidenceReference: string;
  reviewedAt: string; activityKind: string;
}
export function listManagedAllocations264(input: {
  actorUserId: string; campgroundId: string;
}): Promise<{
  status: string; reservations: StaffAllocation264[]; pilotReviews: PilotReview264[];
  coverageCapped?: boolean;
}>;
export function listOwnRentalAllocations264(input: {
  guestUserId: string;
}): Promise<{ status: string; reservations: GuestAllocation264[] }>;
export function reserveRentalAsset264(input: {
  actorUserId: string; actorSessionId: string | null; campgroundId: string;
  input: Record<string,unknown>;
}): Promise<string>;
export function cancelRentalAsset264(input: {
  actorUserId: string; actorSessionId: string | null;
  campgroundId: string; allocationId: string;
}): Promise<string>;
export function recordSupervisedPilotReview264(input: {
  actorUserId: string; actorSessionId: string | null; campgroundId: string;
  input: Record<string,unknown>;
}): Promise<string>;
export function closeRentalAllocation264PoolForTests(): Promise<void>;
