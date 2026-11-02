export interface Tag {
  id: string;
  tag_code: string;
  stream: string;
  price_cents: number;
  receipt_reference: string;
  accommodation_code: string;
  redeemed_at: string | null;
  redeemed_pickup_id: string | null;
  issued_at: string;
}
export declare function listGarbageTags(
  userId: string,
  campgroundId: string,
): Promise<{
  tags: Tag[];
  sites: Array<{ id: string; code: string }>;
  pickups: Array<{
    id: string;
    stream: string;
    accommodation_code: string;
    accommodation_id: string;
    state: string;
  }>;
}>;
export declare function issueGarbageTag(input: {
  actorUserId: string;
  campgroundId: string;
  accommodationId: string;
  reservationId?: string | null;
  stream: string;
  priceCents: unknown;
  receiptReference: string;
  saleId: string;
}): Promise<Tag>;
export declare function redeemGarbageTag(input: {
  actorUserId: string;
  campgroundId: string;
  tagCode: string;
  pickupId: string;
}): Promise<Tag>;
