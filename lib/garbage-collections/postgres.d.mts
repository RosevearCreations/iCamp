export interface CollectionRoute {
  id: string;
  name: string;
  stream: string;
  service_date: string;
  route_note: string | null;
}
export interface CollectionPickup {
  id: string;
  stream: string;
  state: string;
  service_mode: string;
  accommodation_code: string;
}
export interface CollectionProof {
  id: string;
  route_id: string;
  pickup_id: string;
  outcome: string;
  bag_count: number;
  note: string;
  evidence_reference: string | null;
  recorded_at: string;
  accommodation_code: string;
}
export interface CollectionTag {
  id: string;
  tag_code: string;
  stream: string;
  price_cents: number;
  receipt_reference: string;
  redeemed_at: string | null;
  accommodation_code: string;
}
export interface CollectionReview {
  id: string;
  tag_id: string;
  decision: string;
  checked_amount_cents: number | null;
  note: string;
  reviewed_at: string;
}
export declare function getCollectionOperations(
  userId: string,
  campgroundId: string,
): Promise<{
  routes: CollectionRoute[];
  proofs: CollectionProof[];
  pickups: CollectionPickup[];
}>;
export declare function createCollectionRoute(input: {
  actorUserId: string;
  campgroundId: string;
  clientRouteId: string;
  name: string;
  stream: string;
  serviceDate: string;
  note?: string;
}): Promise<CollectionRoute>;
export declare function recordCollectionProof(input: {
  actorUserId: string;
  campgroundId: string;
  routeId: string;
  pickupId: string;
  outcome: string;
  bagCount: unknown;
  note: string;
  evidenceReference?: string;
}): Promise<CollectionProof>;
export declare function getGarbageFinanceReview(
  userId: string,
  campgroundId: string,
): Promise<{ tags: CollectionTag[]; reviews: CollectionReview[] }>;
export declare function recordGarbageFinanceReview(input: {
  actorUserId: string;
  campgroundId: string;
  clientReviewId: string;
  tagId: string;
  decision: string;
  checkedAmountCents?: unknown;
  note: string;
}): Promise<CollectionReview>;
