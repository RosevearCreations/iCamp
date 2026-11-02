import type { RentalOffer } from "./core.mjs";
export interface RentalCandidate {
  id: string;
  name: string;
  code: string;
  kind: string;
  type: string;
  operatingState: string;
  lifecycleState: string;
  alreadyListed: boolean;
}
export interface RentalRequest {
  id: string;
  offerId: string;
  reservationId: string;
  assetName: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  guestNote?: string;
  campgroundName?: string;
}
export function closeRentalPlannerPoolForTests(): Promise<void>;
export function listRentalCampgrounds(): Promise<
  { id: string; name: string; slug: string }[]
>;
export function listPublicRentalOffers(filters?: {
  campgroundSlug?: string;
  kind?: string;
  startDate?: string;
  endDate?: string;
}): Promise<RentalOffer[]>;
export function listManagedRentalOffers(input: {
  userId: string;
  campgroundId: string;
}): Promise<RentalOffer[]>;
export function listRentalAssetCandidates(input: {
  userId: string;
  campgroundId: string;
}): Promise<RentalCandidate[]>;
export function listManagedRentalRequests(input: {
  userId: string;
  campgroundId: string;
}): Promise<RentalRequest[]>;
export function saveRentalOffer(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  offerId?: string;
  assetId: string;
  expectedRowVersion: number;
  input: {
    description: unknown;
    accessibilityNote: unknown;
    returnGuidance: unknown;
    maxDays: unknown;
    isPublished: boolean;
    acceptingRequests: boolean;
  };
}): Promise<string>;
export function listOwnRentalRequests(input: {
  userId: string;
}): Promise<RentalRequest[]>;
export function submitRentalPlanningRequest(input: {
  userId: string;
  actorSessionId: string;
  offerId: string;
  reservationId: string;
  input: {
    startDate: unknown;
    endDate: unknown;
    guestNote: unknown;
    clientRequestId: unknown;
  };
}): Promise<string>;
export function withdrawRentalPlanningRequest(input: {
  userId: string;
  actorSessionId: string;
  requestId: string;
}): Promise<void>;
export function reviewRentalPlanningRequest(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  requestId: string;
  decision: string;
}): Promise<void>;
