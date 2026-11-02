export interface StoreProduct {
  id: string;
  campgroundId: string;
  campgroundName: string;
  campgroundSlug: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  staffReportedStock: number | null;
  stockVerifiedAt: string | null;
  isPublished: boolean;
  rowVersion: number;
}
export interface StoreLine {
  productId: string;
  quantity: number;
  productName: string;
  sku: string;
  isPublished: boolean;
  staffReportedStock: number | null;
  stockVerifiedAt: string | null;
}
export interface StoreCart {
  id: string;
  campgroundId: string;
  campgroundName: string;
  guestUserId: string;
  reservationId: string | null;
  fulfillmentPreference: string;
  deliveryDate: string | null;
  deliveryNote: string;
  reviewState: string;
  reviewRequestedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  rowVersion: number;
  lines: StoreLine[];
}
export function closeStorePoolForTests(): Promise<void>;
export function listStoreCampgrounds(): Promise<
  { id: string; name: string; slug: string }[]
>;
export function listPublicStoreProducts(input?: {
  campgroundSlug?: string;
  category?: string;
  search?: string;
}): Promise<StoreProduct[]>;
export function listManagedStoreProducts(input: {
  userId: string;
  campgroundId: string;
}): Promise<StoreProduct[]>;
export function saveStoreProduct(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  productId?: string;
  expectedRowVersion: number;
  input: {
    sku: unknown;
    name: unknown;
    description: unknown;
    category: unknown;
    stock: unknown;
    isPublished: boolean;
  };
}): Promise<string>;
export function listOwnStoreCarts(input: {
  userId: string;
}): Promise<StoreCart[]>;
export function addToStoreCart(input: {
  userId: string;
  actorSessionId: string;
  campgroundId: string;
  productId: string;
  quantity: unknown;
}): Promise<string>;
export function setStoreCartLineQuantity(input: {
  userId: string;
  actorSessionId: string;
  cartId: string;
  productId: string;
  quantity: unknown;
}): Promise<void>;
export function saveStoreDeliveryPlan(input: {
  userId: string;
  actorSessionId: string;
  cartId: string;
  requestReview?: boolean;
  input: {
    fulfillmentPreference: unknown;
    reservationId: unknown;
    deliveryDate: unknown;
    deliveryNote: unknown;
  };
}): Promise<void>;
export function listStoreReviewQueue(input: {
  userId: string;
  campgroundId: string;
}): Promise<StoreCart[]>;
export function reviewStoreCart(input: {
  actorUserId: string;
  actorSessionId: string;
  campgroundId: string;
  cartId: string;
  decision: string;
}): Promise<void>;
